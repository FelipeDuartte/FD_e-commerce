import { useLocation, useNavigate } from "react-router-dom";
import "./Confirm.css";

const paymentLabels = {
  pix:  { icon: "⚡", label: "PIX" },
  card: { icon: "💳", label: "Cartão" },
  cash: { icon: "💵", label: "Dinheiro" },
};

export default function Confirmacao() {
  const location = useLocation();
  const navigate  = useNavigate();

  const {
    orderId   = null,
    cartItems = [],
    total     = 0,
    payment   = "pix",
    address   = {},
  } = location.state ?? {};

  // Se não tem orderId, redireciona para home
  if (!orderId) {
    return (
      <div className="cf-root">
        <div className="cf-wrap cf-center">
          <p className="cf-not-found">Nenhum pedido encontrado.</p>
          <button className="cf-btn-home" onClick={() => navigate("/dudu-bebidas/")}>
            Voltar para a loja
          </button>
        </div>
      </div>
    );
  }

  const paymentInfo = paymentLabels[payment] ?? { icon: "💳", label: payment };

  // Formata o ID curto para exibição: últimos 8 caracteres
  const shortId = orderId.slice(-8).toUpperCase();

  return (
    <div className="cf-root">

      {/* Partículas decorativas */}
      <div className="cf-particle cf-p1" />
      <div className="cf-particle cf-p2" />
      <div className="cf-particle cf-p3" />

      <div className="cf-wrap">

        {/* ── HERO DE SUCESSO ── */}
        <div className="cf-hero">
          <div className="cf-check-ring">
            <div className="cf-check-circle">
              <svg viewBox="0 0 52 52" className="cf-checkmark">
                <circle cx="26" cy="26" r="25" fill="none" />
                <path fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
              </svg>
            </div>
          </div>

          <div className="cf-hero-text">
            <div className="cf-tag">PEDIDO CONFIRMADO</div>
            <h1 className="cf-title">Pedido recebido!</h1>
            <p className="cf-subtitle">
              Seu pedido foi registrado com sucesso e já está sendo preparado.
            </p>
          </div>

          <div className="cf-order-id">
            <span className="cf-order-id-label">Nº DO PEDIDO</span>
            <span className="cf-order-id-value">#{shortId}</span>
          </div>
        </div>

        {/* ── GRID PRINCIPAL ── */}
        <div className="cf-grid">

          {/* COLUNA ESQUERDA */}
          <div className="cf-col">

            {/* Itens do pedido */}
            <div className="cf-card">
              <div className="cf-card-label">🛒 Itens do Pedido</div>
              <div className="cf-items">
                {cartItems.map((item, i) => (
                  <div className="cf-item" key={i}>
                    <div className="cf-item-img">
                      {item.icon
                        ? <img src={item.icon} alt={item.name} />
                        : "🍺"}
                    </div>
                    <div className="cf-item-info">
                      <span className="cf-item-name">{item.name}</span>
                      <span className="cf-item-qty">{item.quantity} unidade(s)</span>
                    </div>
                    <span className="cf-item-price">
                      R$ {(item.price * item.quantity).toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                ))}
              </div>

              <div className="cf-total-row">
                <span>Total pago</span>
                <span className="cf-total-value">
                  R$ {total.toFixed(2).replace(".", ",")}
                </span>
              </div>
            </div>

            {/* Endereço */}
            <div className="cf-card">
              <div className="cf-card-label">📍 Endereço de Entrega</div>
              <div className="cf-address">
                <p className="cf-address-name">{address.name}</p>
                <p>{address.street}, {address.number}
                  {address.complement ? ` — ${address.complement}` : ""}
                </p>
                <p>{address.district}</p>
                <p className="cf-address-phone">📞 {address.phone}</p>
              </div>
            </div>

          </div>

          {/* COLUNA DIREITA */}
          <div className="cf-col">

            {/* Pagamento */}
            <div className="cf-card cf-card-payment">
              <div className="cf-card-label">💳 Forma de Pagamento</div>
              <div className="cf-payment">
                <span className="cf-payment-icon">{paymentInfo.icon}</span>
                <span className="cf-payment-label">{paymentInfo.label}</span>
              </div>
            </div>

            {/* Timeline de status */}
            <div className="cf-card">
              <div className="cf-card-label">📦 Status do Pedido</div>
              <div className="cf-timeline">
                <div className="cf-tl-item cf-tl-done">
                  <div className="cf-tl-dot">✓</div>
                  <div className="cf-tl-content">
                    <span className="cf-tl-title">Pedido confirmado</span>
                    <span className="cf-tl-desc">Seu pedido foi recebido</span>
                  </div>
                </div>
                <div className="cf-tl-line" />
                <div className="cf-tl-item cf-tl-active">
                  <div className="cf-tl-dot cf-tl-dot-active">2</div>
                  <div className="cf-tl-content">
                    <span className="cf-tl-title">Em preparação</span>
                    <span className="cf-tl-desc">Separando seus produtos</span>
                  </div>
                </div>
                <div className="cf-tl-line cf-tl-line-inactive" />
                <div className="cf-tl-item cf-tl-inactive">
                  <div className="cf-tl-dot cf-tl-dot-inactive">3</div>
                  <div className="cf-tl-content">
                    <span className="cf-tl-title">Saiu para entrega</span>
                    <span className="cf-tl-desc">A caminho do seu endereço</span>
                  </div>
                </div>
                <div className="cf-tl-line cf-tl-line-inactive" />
                <div className="cf-tl-item cf-tl-inactive">
                  <div className="cf-tl-dot cf-tl-dot-inactive">4</div>
                  <div className="cf-tl-content">
                    <span className="cf-tl-title">Entregue</span>
                    <span className="cf-tl-desc">Pedido finalizado</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Botão voltar */}
            <button
              className="cf-btn-home"
              onClick={() => navigate("/dudu-bebidas/")}
            >
              🏠 Voltar para a loja
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}