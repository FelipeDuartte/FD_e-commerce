import {
  getConfig,
  getNext,
  getStatuses,
  getStatusMap,
  isPickup,
  formatDate,
  formatBRL,
  PAYMENT_LABEL,
} from "./adminUtils";
import { shortOrderId } from "../../utils/orderId";

export default function OrderCard({
  order,
  isExpanded,
  isUpdating,
  onToggle,
  onAccept,
  onReject,
  onAdvance,
  onSetStatus,
}) {
  const pickup = isPickup(order);
  const cfg = getConfig(order);
  const nextSt = getNext(order);
  const statuses = getStatuses(order);
  const statusMap = getStatusMap(order);
  const isPending = order.status === "pending";
  const payment = PAYMENT_LABEL[order.payment_method] ?? {
    icon: "💳",
    label: order.payment_method,
  };
  const shortId = shortOrderId(order.id);

  return (
    <li className={`adm-order adm-order-${order.status}`}>
      <div
        className="adm-order-main"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onToggle()}
      >
        <div className="adm-order-status">
          <span className="adm-status-icon">{cfg.icon}</span>
          <span className="adm-status-label" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
          {pickup && <span className="adm-retirada-badge">🏪 RETIRADA</span>}
        </div>

        <div className="adm-order-info">
          <span className="adm-order-id">#{shortId}</span>
          <span className="adm-order-name">{order.address?.name ?? "—"}</span>
          {pickup ? (
            <span className="adm-order-retirada-info">🏪 Retirada na loja</span>
          ) : (
            <span className="adm-order-district">
              📍 {order.address?.district ?? "—"}
            </span>
          )}
        </div>

        <div className="adm-order-payment">
          <span>
            {payment.icon} {payment.label}
          </span>
          <span className="adm-order-total">{formatBRL(order.total)}</span>
        </div>

        {isPending && (
          <div
            className="adm-order-actions"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="adm-btn-accept"
              onClick={onAccept}
              disabled={isUpdating}
              title={pickup ? "Confirmar retirada" : "Aceitar pedido"}
            >
              {isUpdating ? "..." : `✓ ${pickup ? "Confirmar" : "Aceitar"}`}
            </button>
            <button
              className="adm-btn-reject"
              onClick={onReject}
              disabled={isUpdating}
            >
              ✕ Rejeitar
            </button>
          </div>
        )}

        <span className="adm-order-date">{formatDate(order.created_at)}</span>
        <span
          className={`adm-chevron ${isExpanded ? "open" : ""}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </div>

      {isExpanded && (
        <div
          className={`adm-order-detail adm-order-detail--${pickup ? "pickup" : "delivery"}`}
        >
          <div className="adm-detail-section">
            <div className="adm-detail-label">🛒 Itens</div>
            <div className="adm-items">
              {(order.order_items ?? []).map((item) => (
                <div className="adm-item" key={item.id}>
                  <span className="adm-item-name">{item.name}</span>
                  <span className="adm-item-qty">x{item.quantity}</span>
                  <span className="adm-item-price">
                    {formatBRL(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="adm-detail-section">
            <div className="adm-detail-label">
              {pickup ? "🏪 Informações da Retirada" : "📍 Endereço"}
            </div>
            <div className="adm-address">
              <p>
                <strong>{order.address?.name}</strong>
              </p>
              {pickup ? (
                <>
                  <p>🏪 Retirada na loja</p>
                  <p>📍 Rua Edgar Torres, 650 — Belo Horizonte/MG</p>
                </>
              ) : (
                <>
                  <p>
                    {order.address?.street}, {order.address?.number}
                    {order.address?.complement
                      ? ` — ${order.address.complement}`
                      : ""}
                  </p>
                  <p>{order.address?.district}</p>
                </>
              )}
              <p>📞 {order.address?.phone}</p>
            </div>
          </div>

          <div className="adm-detail-section">
            <div className="adm-detail-label">
              {pickup ? "🔄 Status da Retirada" : "🔄 Alterar Status"}
            </div>

            {isPending ? (
              <div className="adm-accept-reject-detail">
                <button
                  className="adm-btn-accept-lg"
                  onClick={onAccept}
                  disabled={isUpdating}
                >
                  {isUpdating
                    ? "Processando..."
                    : `✓ ${pickup ? "Confirmar Retirada" : "Aceitar Pedido"}`}
                </button>
                <button
                  className="adm-btn-reject-lg"
                  onClick={onReject}
                  disabled={isUpdating}
                >
                  ✕ Rejeitar Pedido
                </button>
              </div>
            ) : (
              <>
                <div className="adm-status-pills">
                  {statuses.map((s) => (
                    <button
                      key={s}
                      className={`adm-pill ${order.status === s ? "adm-pill-active" : ""}`}
                      style={{ "--pill-color": statusMap[s]?.color }}
                      onClick={() => onSetStatus(s)}
                      disabled={isUpdating}
                    >
                      {statusMap[s]?.icon} {statusMap[s]?.label}
                    </button>
                  ))}
                </div>

                {nextSt ? (
                  <button
                    className="adm-btn-advance"
                    onClick={onAdvance}
                    disabled={isUpdating}
                  >
                    {isUpdating
                      ? "Atualizando..."
                      : `Avançar para: ${statusMap[nextSt]?.icon} ${statusMap[nextSt]?.label} →`}
                  </button>
                ) : (
                  <div className="adm-delivered-msg">
                    {pickup ? "✅ Retirada finalizada" : "✅ Pedido finalizado"}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
