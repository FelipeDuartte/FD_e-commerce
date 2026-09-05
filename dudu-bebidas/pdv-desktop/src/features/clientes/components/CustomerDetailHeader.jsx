import { formatBRL, formatLastOrder, formatPhone } from "../../../shared/utils/format";

export default function CustomerDetailHeader({
  customer, ordersLoading, ordersCount, onEdit, onPay, onNewCharge,
  onToggleActive, togglingActive, onRequestDelete, payError, chargeError, statusError,
}) {
  return (
    <>
      <div className="pdv-fiado-detail-header">
        <div>
          <h2 className="adm-store-section-title">
            {customer.name}
            {customer.isActive === false && <span className="pdv-clientes-inactive-badge">Desativado</span>}
          </h2>
          {customer.phone && <p className="adm-store-section-desc">{formatPhone(customer.phone)}</p>}
          {customer.email && <p className="adm-store-section-desc">{customer.email}</p>}
          {customer.address && <p className="adm-store-section-desc">{customer.address}</p>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {customer.balance > 0.004 && (
            <button className="adm-btn-new-product" onClick={onPay}>
              💰 Receber pagamento
            </button>
          )}
          <button className="pdv-clientes-secondary-btn" onClick={onNewCharge}>
            📝 Novo pedido em aberto
          </button>
        </div>
      </div>

      <div className="pdv-clientes-actions">
        <button className="pdv-clientes-secondary-btn" onClick={onEdit}>✏️ Editar</button>
        <button className="pdv-clientes-secondary-btn" onClick={onToggleActive} disabled={togglingActive}>
          {customer.isActive === false ? "✅ Reativar" : "🚫 Desativar"}
        </button>
        <button className="pdv-clientes-secondary-btn pdv-clientes-danger-btn" onClick={onRequestDelete}>
          🗑️ Excluir
        </button>
      </div>

      {payError && <div className="adm-modal-error">⚠️ {payError}</div>}
      {chargeError && <div className="adm-modal-error">⚠️ {chargeError}</div>}
      {statusError && <div className="adm-modal-error">⚠️ {statusError}</div>}

      <div className="pdv-clientes-stats">
        <div className="pdv-clientes-stat">
          <span>{customer.balance < 0 ? "Crédito a favor" : "Saldo devedor"}</span>
          <strong className={customer.balance < 0 ? "pdv-clientes-has-credit" : customer.balance > 0 ? "pdv-fiado-has-debt" : ""}>
            {formatBRL(Math.abs(customer.balance))}
          </strong>
        </div>
        <div className="pdv-clientes-stat">
          <span>Consumo total</span>
          <strong>{formatBRL(customer.totalFiado)}</strong>
        </div>
        <div className="pdv-clientes-stat">
          <span>Compras</span>
          <strong>{ordersLoading ? "…" : ordersCount}</strong>
        </div>
        <div className="pdv-clientes-stat">
          <span>Última compra</span>
          <strong>{formatLastOrder(customer.lastOrderAt)}</strong>
        </div>
      </div>
    </>
  );
}
