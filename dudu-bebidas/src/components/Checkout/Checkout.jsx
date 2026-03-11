import { useState } from "react";
import "./Checkout.css";
import { useNavigate } from "react-router-dom";
const items = [
  { icon: "🍺", name: "Heineken", qty: "2 unidades", price: "R$ 17,00" },
  { icon: "⚡", name: "Red Bull", qty: "1 unidade", price: "R$ 12,00" },
  { icon: "🥃", name: "Jack Daniel's", qty: "1 unidade", price: "R$ 120,00" },
];

const paymentOptions = [
  { value: "pix", icon: "⚡", name: "PIX" },
  { value: "card", icon: "💳", name: "Cartão" },
  { value: "cash", icon: "💵", name: "Dinheiro" },
];

export default function Checkout({ openCart }) {
  const [payment, setPayment] = useState("pix");
  //navegação
  const navigate = useNavigate();
  return (
    <div className="co-root">
      <div className="co-wrap">
        {/* HEADER */}
        <div className="co-header">
          <button
            className="co-back"
            onClick={() => navigate("/dudu-bebidas/", { state: { openCart: true } })}
          >
            ←
          </button>
          <div className="co-header-text">
            <div className="co-step-label">Passo 2 de 2</div>
            <h1 className="co-title">Finalizar Pedido</h1>
          </div>
        </div>

        {/* PROGRESS */}
        <div className="co-progress">
          <div className="co-prog-step">
            <div className="co-prog-dot">✓</div>
            <span className="co-prog-label">Carrinho</span>
          </div>
          <div className="co-prog-line" />
          <div className="co-prog-step">
            <div className="co-prog-dot">2</div>
            <span className="co-prog-label">Checkout</span>
          </div>
          <div className="co-prog-line" />
          <div className="co-prog-step">
            <div className="co-prog-dot inactive">3</div>
            <span className="co-prog-label inactive">Confirmação</span>
          </div>
        </div>

        {/* MAIN GRID */}
        <div className="co-grid">
          {/* FORM */}
          <div className="co-card">
            <div className="co-section-label">📍 Entrega</div>

            <div className="co-field-row">
              <div className="co-field">
                <label>Nome completo</label>
                <input type="text" placeholder="Seu nome" />
              </div>
              <div className="co-field">
                <label>Telefone</label>
                <input type="text" placeholder="(00) 00000-0000" />
              </div>
            </div>

            <div className="co-field-row">
              <div className="co-field">
                <label>Endereço</label>
                <input type="text" placeholder="Rua / Av." />
              </div>
              <div className="co-field">
                <label>Número</label>
                <input type="text" placeholder="123" />
              </div>
            </div>

            <div className="co-field-row">
              <div className="co-field">
                <label>Bairro</label>
                <input type="text" placeholder="Bairro" />
              </div>
              <div className="co-field">
                <label>Complemento</label>
                <input type="text" placeholder="Apto, bloco..." />
              </div>
            </div>

            <div className="co-divider" />

            <div className="co-section-label">💳 Pagamento</div>

            <div className="co-pay-grid">
              {paymentOptions.map((opt) => (
                <div className="co-pay-option" key={opt.value}>
                  <input
                    type="radio"
                    id={opt.value}
                    name="payment"
                    value={opt.value}
                    checked={payment === opt.value}
                    onChange={() => setPayment(opt.value)}
                  />
                  <label className="co-pay-label" htmlFor={opt.value}>
                    <span className="co-pay-icon">{opt.icon}</span>
                    <span className="co-pay-name">{opt.name}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* SUMMARY */}
          <div className="co-summary">
            <div className="co-summary-title">Resumo</div>

            <div className="co-items">
              {items.map((item, i) => (
                <div className="co-item" key={i}>
                  <div className="co-item-icon">{item.icon}</div>
                  <div className="co-item-info">
                    <div className="co-item-name">{item.name}</div>
                    <div className="co-item-qty">{item.qty}</div>
                  </div>
                  <div className="co-item-price">{item.price}</div>
                </div>
              ))}
            </div>

            <div className="co-summary-rows">
              <div className="co-summary-row">
                <span>Subtotal</span>
                <span>R$ 149,00</span>
              </div>
              <div className="co-summary-row">
                <span>Entrega</span>
                <span>R$ 5,00</span>
              </div>
            </div>

            <div className="co-total-row">
              <span className="co-total-label">Total</span>
              <span className="co-total-value">R$ 154,00</span>
            </div>

            <button className="co-cta">Confirmar Pedido →</button>

            <div className="co-secure">🔒 Pagamento 100% seguro</div>
          </div>
        </div>
      </div>
    </div>
  );
}
