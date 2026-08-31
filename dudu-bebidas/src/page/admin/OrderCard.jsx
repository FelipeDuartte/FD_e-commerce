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

const PAYMENT_STATUS_LABEL = {
  aguardando_pagamento: "⏳ Aguardando pagamento",
  processando_pagamento: "⏳ Processando pagamento",
  pagamento_recusado: "❌ Pagamento recusado",
  pagamento_cancelado: "🚫 Pagamento cancelado",
  pagamento_expirado: "⌛ Pagamento expirado",
};

export default function OrderCard({
  order,
  isExpanded,
  isUpdating,
  onToggle,
  onAccept,
  onReject,
  onAdvance,
  onSetStatus,
  onMarkPaid,
}) {
  const pickup = isPickup(order);
  const cfg = getConfig(order);
  const nextSt = getNext(order);
  const statuses = getStatuses(order);
  const statusMap = getStatusMap(order);
  const isPending = order.status === "pending";
  // Pix ainda não confirmado pelo admin — não faz sentido aceitar/rejeitar
  // preparo de algo que ainda não foi pago. "Pagamento na entrega" nasce
  // com payment_status "aguardando_pagamento" também (é só registro, não
  // bloqueia nada), então essa checagem é restrita a pix de propósito. Só
  // esse caso mostra o botão "Marcar como pago" — cartão online (Mercado
  // Pago) é confirmado sozinho pelo webhook; um botão manual aqui pularia
  // a baixa de estoque, que só acontece na confirmação real do pagamento.
  const pixAwaitingPayment =
    order.payment_method === "pix" && order.payment_status === "aguardando_pagamento";
  // Cartão online ainda não aprovado (ou recusado) — mesma lógica de
  // "não deixa aceitar/rejeitar preparo de algo que ainda não foi pago",
  // só que sem botão manual: a confirmação é automática via webhook.
  const mercadopagoNotPaid =
    order.payment_method === "mercadopago_card" && order.payment_status !== "pago";
  const paymentBlocksAcceptance = pixAwaitingPayment || mercadopagoNotPaid;
  const payment = PAYMENT_LABEL[order.payment_method] ?? {
    icon: "💳",
    label: order.payment_method,
  };
  const shortId = order.order_number ? String(order.order_number) : order.id.slice(-8).toUpperCase();

  // Uma única mensagem de status de pagamento, não duas competindo pelo
  // mesmo espaço: "aguardando pagamento" (cliente não fez nada ainda) e
  // "cliente informou pagamento" (cliente JÁ apertou "já paguei") são
  // estados diferentes — mostrar os dois juntos parecia contraditório.
  const claimedAt = order.customer_claimed_paid_at
    ? new Date(order.customer_claimed_paid_at).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const paymentStatusText =
    pixAwaitingPayment && claimedAt
      ? `🔔 Cliente informou pagamento às ${claimedAt}`
      : (PAYMENT_STATUS_LABEL[order.payment_status] ?? order.payment_status);

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
          {order.channel === "balcao" && (
            <span className="adm-retirada-badge">🧾 BALCÃO</span>
          )}
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
            {["credit_card", "mercadopago_card"].includes(order.payment_method) && order.installments > 1
              ? ` · ${order.installments}x`
              : ""}
            {["pix", "mercadopago_card"].includes(order.payment_method) &&
              order.payment_status &&
              order.payment_status !== "pago" && (
                <span className={claimedAt ? "adm-order-claimed" : "adm-order-discount"}>
                  {" "}· {paymentStatusText}
                </span>
              )}
          </span>
          <span className="adm-order-total">
            {formatBRL(order.total)}
            {order.discount_amount > 0 && (
              <span className="adm-order-discount"> (−{formatBRL(order.discount_amount)})</span>
            )}
          </span>
        </div>

        {pixAwaitingPayment && (
          <div className="adm-order-actions" onClick={(e) => e.stopPropagation()}>
            <button className="adm-btn-accept" onClick={onMarkPaid} disabled={isUpdating}>
              {isUpdating ? "..." : "✅ Marcar como pago"}
            </button>
          </div>
        )}

        {mercadopagoNotPaid && (
          <div className="adm-order-actions" onClick={(e) => e.stopPropagation()}>
            <span className="adm-order-discount">
              {order.payment_status === "pagamento_recusado"
                ? "❌ Pagamento recusado pela operadora"
                : "⏳ Aguardando confirmação automática do pagamento"}
            </span>
          </div>
        )}

        {isPending && !paymentBlocksAcceptance && (
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

            {isPending && pixAwaitingPayment ? (
              <div className="adm-accept-reject-detail">
                <p className="adm-delivered-msg">
                  💰 Aguardando confirmação do pagamento — confirme abaixo pra
                  liberar aceitar/rejeitar.
                </p>
                <button
                  className="adm-btn-accept-lg"
                  onClick={onMarkPaid}
                  disabled={isUpdating}
                >
                  {isUpdating ? "Processando..." : "✅ Marcar como pago"}
                </button>
              </div>
            ) : isPending && mercadopagoNotPaid ? (
              <div className="adm-delivered-msg">
                {order.payment_status === "pagamento_recusado"
                  ? "❌ Pagamento recusado — nada a preparar."
                  : "⏳ Aguardando confirmação automática do pagamento pelo Mercado Pago."}
              </div>
            ) : isPending ? (
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