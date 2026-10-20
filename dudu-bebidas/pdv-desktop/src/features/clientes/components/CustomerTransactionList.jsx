import { formatBRL } from "../../../shared/utils/format";
import { SPLIT_PAYMENT_METHODS } from "../../../shared/constants";

const TX_FILTERS = [
  { key: "todas", label: "Todas" },
  { key: "compras", label: "Compras" },
  { key: "pagamentos", label: "Pagamentos" },
  { key: "creditos", label: "Créditos" },
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
  paidDebitIds, cancellingId, onCancelSale, onReturnItem, cancelError,
  onEditPayment, onDeletePayment,
}) {
  return (
    <div>
      <h3 className="adm-store-section-title pdv-fiado-orders-title">Transações</h3>
      {cancelError && <div className="adm-modal-error">⚠️ {cancelError}</div>}
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
                  <div className="pdv-clientes-tx-actions">
                    <button className="adm-btn-edit" title="Editar pagamento" onClick={() => onEditPayment(t)}>
                      ✏️
                    </button>
                    <button className="adm-btn-delete" title="Apagar pagamento" onClick={() => onDeletePayment(t)}>
                      🗑️
                    </button>
                  </div>
                </div>
              );
            }
            if (t.type === "credito") {
              const isReturn = t.reason === "devolucao";
              return (
                <div key={t.key} className="pdv-clientes-tx-row">
                  <span className="pdv-sale-time">{formatDateTime(t.createdAt)}</span>
                  <span className="pdv-clientes-tx-badge pdv-clientes-tx-badge-credit">
                    {isReturn ? "↩️ Devolução" : "🎁 Retirada"}
                  </span>
                  <span className="pdv-sale-items" title={t.productName}>{t.productName}</span>
                  <strong className={isReturn ? "pdv-clientes-tx-credit" : ""}>
                    {isReturn ? "+" : "−"}{Math.abs(t.quantity)} un.
                  </strong>
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
            // Pedido em aberto cancela em qualquer dia enquanto não estiver
            // pago (o dinheiro do fiado só entra no caixa quando é pago).
            // Pago → só ↩️ Devolver, que vira crédito de produto.
            const canCancel = !t.cancelled && !paid;
            // Pedido fiado tem lista de itens de altura variável (1 a vários
            // produtos) — por isso usa um cartão empilhado (cabeçalho numa
            // linha + itens embaixo, largura cheia) em vez do grid de colunas
            // fixas das outras transações, que espremia os nomes e quebrava
            // o layout em telas mais estreitas.
            return (
              <div
                key={t.key}
                className={`pdv-clientes-tx-card ${t.cancelled && !t.fullyReturned ? "pdv-sale-cancelled" : ""} ${t.fullyReturned ? "pdv-sale-returned" : ""}`}
              >
                <div className="pdv-clientes-tx-card-head">
                  <span className="pdv-sale-time">{formatDateTime(t.createdAt)}</span>
                  <span className="pdv-clientes-tx-badge pdv-clientes-tx-badge-purchase">
                    🛒{t.orderNumber ? ` #${t.orderNumber}` : ""}
                  </span>
                  <div className="pdv-clientes-tx-card-head-right">
                    <strong>{formatBRL(t.total)}</strong>
                    {t.fullyReturned ? (
                      <span className="pdv-sale-returned-label">Devolvido</span>
                    ) : t.cancelled ? (
                      <span className="pdv-sale-cancelled-label">Cancelada</span>
                    ) : paid ? (
                      <span className="pdv-fiado-order-paid-label">Pago</span>
                    ) : canCancel ? (
                      <button
                        className="adm-btn-delete"
                        title="Cancelar pedido inteiro (cliente desistiu / lançado errado)"
                        onClick={() => onCancelSale(t)}
                        disabled={cancellingId === t.orderId}
                      >
                        {cancellingId === t.orderId ? "..." : "🗑️"}
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="pdv-sale-items-list">
                  {t.orderItems?.length
                    ? t.orderItems.map((item) => (
                        <div key={item.id} className="pdv-sale-item-line">
                          <span>
                            {item.quantity === 0 ? item.name : item.quantity > 1 ? `${item.name} x${item.quantity}` : item.name}
                            {item.quantity === 0 ? (
                              <span className="pdv-sale-item-returned"> · devolvido</span>
                            ) : item.returnedQuantity + item.deductedQuantity > 0 && (
                              <span className="pdv-sale-item-returned">
                                {" "}· {item.returnedQuantity + item.deductedQuantity} devolvida(s)
                              </span>
                            )}
                          </span>
                          {!t.cancelled && item.quantity - item.returnedQuantity > 0 && (
                            <button
                              type="button"
                              className="pdv-sale-item-return-btn"
                              title="Devolver / remover item (inteiro ou parte)"
                              onClick={() => onReturnItem(t, item)}
                            >
                              ↩️
                            </button>
                          )}
                        </div>
                      ))
                    : t.itemsLabel}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
