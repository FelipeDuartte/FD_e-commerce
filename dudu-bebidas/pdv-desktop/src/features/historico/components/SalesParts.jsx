import { formatBRL } from "../../../shared/utils/format";
import { formatSalePaymentLabel, formatPaymentMethodLabel } from "../../../shared/constants";

// Explode venda dividida ("misto") nas formas reais que a compuseram —
// senão o resumo por forma de pagamento juntava tudo num balde "misto"
// sem dizer quanto foi de cada forma de verdade.
//
// Pedido em aberto (fiado) não entra como dinheiro: ele conta no caixa
// do dia em que o pagamento é recebido (fiadoPayments), não no dia em
// que o pedido foi registrado. Fica só como informação "a receber".
export function summarize(sales, fiadoPayments) {
  const active = sales.filter((s) => !s.cancelled);
  const cancelledCount = sales.length - active.length;
  const paidSales = active.filter((s) => s.paymentMethod !== "fiado");
  const openTotal = active
    .filter((s) => s.paymentMethod === "fiado")
    .reduce((sum, s) => sum + s.total, 0);
  const byMethod = {};
  for (const s of paidSales) {
    if (s.paymentMethod === "misto" && s.payments?.length) {
      for (const p of s.payments) {
        byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount;
      }
    } else {
      byMethod[s.paymentMethod] = (byMethod[s.paymentMethod] ?? 0) + s.total;
    }
  }
  for (const p of fiadoPayments) {
    byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount;
  }
  const total = Object.values(byMethod).reduce((sum, v) => sum + v, 0);
  return { activeCount: active.length, cancelledCount, total, byMethod, openTotal };
}

export function SalesSummary({ summary }) {
  return (
    <div className="pdv-history-summary">
      <div className="pdv-history-summary-main">
        <span className="pdv-history-summary-count">
          {summary.activeCount} venda(s)
          {summary.cancelledCount > 0 && (
            <span className="pdv-history-summary-cancelled"> · {summary.cancelledCount} cancelada(s)</span>
          )}
        </span>
        <strong className="pdv-history-summary-total">{formatBRL(summary.total)}</strong>
      </div>
      {Object.keys(summary.byMethod).length > 0 && (
        <div className="pdv-history-summary-methods">
          {Object.entries(summary.byMethod).map(([method, amount]) => (
            <span key={method} className="pdv-history-summary-method">
              <span>{formatPaymentMethodLabel(method)}</span>
              <strong>{formatBRL(amount)}</strong>
            </span>
          ))}
        </div>
      )}
      {summary.openTotal > 0 && (
        <div className="pdv-history-summary-open">
          📝 Em aberto a receber: {formatBRL(summary.openTotal)}
        </div>
      )}
    </div>
  );
}

// canCancel(sale) decide quem mostra o botão de cancelar — caixa já fechado
// nunca mostra (o banco recusa cancelar venda de caixa fechado).
// canEdit(sale): mostra 🗑️ por item e ✏️ na forma de pagamento — só venda
// paga do caixa aberto (fiado é mexido na aba Clientes).
export function SalesRows({
  sales, canCancel, cancellingId, onCancelSale, onPrint,
  canEdit = () => false, onRemoveItem, onEditPayment,
}) {
  return (
    <div className="pdv-sales-list">
      {sales.map((sale) => {
        const cancellable = !sale.cancelled && canCancel(sale);
        const editable = !sale.cancelled && sale.paymentMethod !== "fiado" && canEdit(sale);
        return (
          <div
            key={sale.orderId}
            className={`pdv-sale-row ${sale.cancelled ? "pdv-sale-cancelled" : ""}`}
          >
            <div className="pdv-sale-id-col">
              {sale.orderNumber != null && <strong className="pdv-sale-number">#{sale.orderNumber}</strong>}
              <span className="pdv-sale-time" title={new Date(sale.createdAt).toLocaleString("pt-BR")}>
                {new Date(sale.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}{" "}
                {new Date(sale.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="pdv-sale-items-list">
              {editable && sale.orderItems?.length
                ? sale.orderItems.map((item) => (
                    <div key={item.id} className="pdv-sale-item-line">
                      <span>{item.quantity > 1 ? `${item.name} x${item.quantity}` : item.name}</span>
                      <button
                        type="button"
                        className="pdv-sale-item-remove-btn"
                        title="Excluir esse item da venda"
                        onClick={() => onRemoveItem(sale, item)}
                      >
                        ❌
                      </button>
                    </div>
                  ))
                : sale.items?.length
                  ? sale.items.map((line, i) => <div key={i}>{line}</div>)
                  : `${sale.itemCount} item(ns)`}
              {sale.deliveryAddress && (
                <div className="pdv-sale-delivery-address">
                  🚚 {sale.deliveryAddress.name ? `${sale.deliveryAddress.name} — ` : ""}
                  {sale.deliveryAddress.street}, {sale.deliveryAddress.number}
                  {sale.deliveryAddress.complement ? ` — ${sale.deliveryAddress.complement}` : ""}
                  {sale.deliveryAddress.district ? ` · ${sale.deliveryAddress.district}` : ""}
                  {sale.deliveryAddress.phone ? ` · 📞 ${sale.deliveryAddress.phone}` : ""}
                </div>
              )}
            </div>
            <span className="pdv-sale-payment">
              {formatSalePaymentLabel(sale)}
              {editable && (
                <button
                  type="button"
                  className="pdv-sale-payment-edit-btn"
                  title="Editar forma de pagamento"
                  onClick={() => onEditPayment(sale)}
                >
                  ✏️
                </button>
              )}
            </span>
            <strong>{formatBRL(sale.total)}</strong>
            <div className="pdv-sale-actions">
              <button
                type="button"
                className="pdv-print-btn"
                title="Imprimir notinha"
                onClick={() => onPrint(sale)}
              >
                🖨️
              </button>
              {sale.cancelled ? (
                <span className="pdv-sale-cancelled-label">Cancelada</span>
              ) : cancellable ? (
                <button
                  className="adm-btn-delete"
                  onClick={() => onCancelSale(sale)}
                  disabled={cancellingId === sale.orderId}
                >
                  {cancellingId === sale.orderId ? "..." : "🗑️ Cancelar"}
                </button>
              ) : (
                <span className="pdv-sale-locked-label" title="Só é possível cancelar vendas do caixa aberto agora">
                  —
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
