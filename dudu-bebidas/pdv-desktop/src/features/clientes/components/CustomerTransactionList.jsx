import { formatBRL } from "../../../shared/utils/format";
import { SPLIT_PAYMENT_METHODS } from "../../../shared/constants";

const TX_FILTERS = [
  { key: "todas", label: "Todas" },
  { key: "compras", label: "Compras" },
  { key: "pagamentos", label: "Pagamentos" },
  { key: "canceladas", label: "Canceladas" },
];

function methodLabel(method) {
  const known = SPLIT_PAYMENT_METHODS.find((m) => m.value === method);
  return known ? `${known.icon} ${known.label}` : method;
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function CustomerTransactionList({
  ordersLoading, filteredTransactions, txFilter, setTxFilter,
  paidDebitIds, currentSessionId, cancellingId, onCancelSale, onRemoveItem,
}) {
  return (
    <div>
      <h3 className="adm-store-section-title pdv-fiado-orders-title">Transações</h3>
      <div className="pdv-clientes-filters pdv-clientes-tx-filters">
        {TX_FILTERS.map((f) => (
          <button
            key={f.key}
            className={`pdv-clientes-filter-btn ${txFilter === f.key ? "active" : ""}`}
            onClick={() => setTxFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {ordersLoading ? (
        <div className="adm-loading"><div className="adm-spinner" /><p>Carregando...</p></div>
      ) : filteredTransactions.length === 0 ? (
        <div className="adm-empty"><p>Nenhuma transação encontrada.</p></div>
      ) : (
        <div className="pdv-clientes-tx-list">
          {filteredTransactions.map((t) => {
            if (t.type === "pagamento") {
              return (
                <div key={t.key} className="pdv-clientes-tx-row">
                  <span className="pdv-sale-time">{formatDateTime(t.createdAt)}</span>
                  <span className="pdv-clientes-tx-badge pdv-clientes-tx-badge-payment">💰 Pagamento</span>
                  <span className="pdv-sale-items">{methodLabel(t.method)}</span>
                  <strong className="pdv-clientes-tx-credit">+{formatBRL(t.amount)}</strong>
                  <span />
                </div>
              );
            }
            if (t.type === "cobranca") {
              const paid = paidDebitIds.has(t.id);
              return (
                <div key={t.key} className="pdv-clientes-tx-row">
                  <span className="pdv-sale-time">{formatDateTime(t.createdAt)}</span>
                  <span className="pdv-clientes-tx-badge pdv-clientes-tx-badge-purchase">📝 Em aberto</span>
                  <span className="pdv-sale-items" title={t.description}>{t.description}</span>
                  <strong>{formatBRL(t.amount)}</strong>
                  {paid ? <span className="pdv-fiado-order-paid-label">Pago</span> : <span />}
                </div>
              );
            }
            const paid = !t.cancelled && paidDebitIds.has(t.orderId);
            const canCancel = !t.cancelled && t.cashSessionId === currentSessionId;
            // Diferente do cancelamento do pedido inteiro (só no caixa aberto
            // agora), remover um item avulso vale pra qualquer pedido fiado
            // ainda não pago — a dívida fica em aberto por dias, não faz
            // sentido travar a correção de um item só porque o caixa daquele
            // dia já fechou.
            const canRemoveItems = !t.cancelled && !paid;
            return (
              <div key={t.key} className={`pdv-clientes-tx-row ${t.cancelled ? "pdv-sale-cancelled" : ""}`}>
                <span className="pdv-sale-time">{formatDateTime(t.createdAt)}</span>
                <span className="pdv-clientes-tx-badge pdv-clientes-tx-badge-purchase">
                  🛒{t.orderNumber ? ` #${t.orderNumber}` : ""}
                </span>
                <div className="pdv-sale-items-list">
                  {t.orderItems?.length
                    ? t.orderItems.map((item) => (
                        <div key={item.id} className="pdv-sale-item-line">
                          <span>{item.quantity > 1 ? `${item.name} x${item.quantity}` : item.name}</span>
                          {canRemoveItems && (
                            <button
                              type="button"
                              className="pdv-sale-item-remove-btn"
                              title="Remover só esse item"
                              onClick={() => onRemoveItem(t, item)}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))
                    : t.itemsLabel}
                </div>
                <strong>{formatBRL(t.total)}</strong>
                <div className="pdv-clientes-tx-actions">
                  {t.cancelled ? (
                    <span className="pdv-sale-cancelled-label">Cancelada</span>
                  ) : paid ? (
                    <span className="pdv-fiado-order-paid-label">Pago</span>
                  ) : canCancel ? (
                    <button
                      className="adm-btn-delete"
                      title="Cancelar venda"
                      onClick={() => onCancelSale(t)}
                      disabled={cancellingId === t.orderId}
                    >
                      {cancellingId === t.orderId ? "..." : "🗑️"}
                    </button>
                  ) : (
                    <span className="pdv-sale-locked-label" title="Só é possível cancelar vendas do caixa aberto agora">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
