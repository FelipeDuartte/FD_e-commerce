import { useEffect, useState } from "react";
import "./Checkout.css";
import { useNavigate, useLocation } from "react-router-dom";
import { saveOrder } from "../../supabase/saveOrder";

const paymentOptions = [
  { value: "pix", icon: "⚡", name: "PIX" },
  { value: "card", icon: "💳", name: "Cartão" },
  { value: "cash", icon: "💵", name: "Dinheiro" },
];

export default function Checkout({ user }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (cartItems.length === 0) {
      navigate("/", { replace: true });
    }
  }, []);

  // Lê os dados passados pelo Cart via navigate state
  const cartItems = location.state?.cartItems ?? [];
  const cartTotal = location.state?.cartTotal ?? 0;
  const DELIVERY = 5;

  const [payment, setPayment] = useState("pix");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [address, setAddress] = useState({
    name: "",
    phone: "",
    street: "",
    number: "",
    district: "",
    complement: "",
  });

  const handleAddressChange = (e) => {
    setAddress((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const validateForm = () => {
    if (!address.name.trim()) return "Por favor, informe seu nome.";
    if (!address.phone.trim()) return "Por favor, informe seu telefone.";
    if (!address.street.trim()) return "Por favor, informe o endereço.";
    if (!address.number.trim()) return "Por favor, informe o número.";
    if (!address.district.trim()) return "Por favor, informe o bairro.";
    return null;
  };

  const handleConfirmOrder = async () => {
    setErrorMsg("");

    if (!user) {
      setErrorMsg("Você precisa estar logado para finalizar o pedido.");
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    if (cartItems.length === 0) {
      setErrorMsg("Seu carrinho está vazio.");
      return;
    }

    setLoading(true);

    const { orderId, error } = await saveOrder({
      userId: user.id,
      total: cartTotal + DELIVERY,
      paymentMethod: payment,
      address,
      cartItems,
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error);
      return;
    }
    navigate("/confirmacao", {
      state: {
        orderId,
        cartItems,
        total: cartTotal + DELIVERY,
        payment,
        address,
      },
    });
  };

  return (
    <div className="co-root">
      <div className="co-wrap">
        {/* ── HEADER ── */}
        <div className="co-header">
          <button
            className="co-back"
            onClick={() => navigate("/", { state: { openCart: true } })}
          >
            ←
          </button>
          <div className="co-header-text">
            <div className="co-step-label">Passo 2 de 2</div>
            <h1 className="co-title">Finalizar Pedido</h1>
          </div>
        </div>

        {/* ── PROGRESS ── */}
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

        {/* ── MAIN GRID ── */}
        <div className="co-grid">
          {/* FORM */}
          <div className="co-card">
            <div className="co-section-label">📍 Entrega</div>

            {errorMsg && <div className="co-error-msg">⚠️ {errorMsg}</div>}

            <div className="co-field-row">
              <div className="co-field">
                <label>Nome completo</label>
                <input
                  type="text"
                  name="name"
                  value={address.name}
                  onChange={handleAddressChange}
                  placeholder="Seu nome"
                />
              </div>
              <div className="co-field">
                <label>Telefone</label>
                <input
                  type="tel"
                  name="phone"
                  value={address.phone}
                  onChange={handleAddressChange}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="co-field-row">
              <div className="co-field">
                <label>Endereço</label>
                <input
                  type="text"
                  name="street"
                  value={address.street}
                  onChange={handleAddressChange}
                  placeholder="Rua / Av."
                />
              </div>
              <div className="co-field">
                <label>Número</label>
                <input
                  type="text"
                  name="number"
                  value={address.number}
                  onChange={handleAddressChange}
                  placeholder="123"
                />
              </div>
            </div>

            <div className="co-field-row two-col-mobile">
              <div className="co-field">
                <label>Bairro</label>
                <input
                  type="text"
                  name="district"
                  value={address.district}
                  onChange={handleAddressChange}
                  placeholder="Bairro"
                />
              </div>
              <div className="co-field">
                <label>Complemento</label>
                <input
                  type="text"
                  name="complement"
                  value={address.complement}
                  onChange={handleAddressChange}
                  placeholder="Apto, bloco..."
                />
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

            {/* ✅ Renderiza os itens vindos do carrinho */}
            <div className="co-items">
              {cartItems.length === 0 ? (
                <p className="co-empty-msg">Nenhum item no carrinho.</p>
              ) : (
                cartItems.map((item, i) => (
                  <div className="co-item" key={i}>
                    <div className="co-item-icon">
                      {/* icon é a URL da imagem vinda do Cart */}
                      {item.icon ? (
                        <img
                          src={item.icon}
                          alt={item.name}
                          style={{
                            width: 36,
                            height: 36,
                            objectFit: "cover",
                            borderRadius: 6,
                          }}
                        />
                      ) : (
                        "🛒"
                      )}
                    </div>
                    <div className="co-item-info">
                      <div className="co-item-name">{item.name}</div>
                      <div className="co-item-qty">
                        {item.quantity} unidade(s)
                      </div>
                    </div>
                    <div className="co-item-price">
                      R${" "}
                      {(item.price * item.quantity)
                        .toFixed(2)
                        .replace(".", ",")}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="co-summary-rows">
              <div className="co-summary-row">
                <span>Subtotal</span>
                <span>R$ {cartTotal.toFixed(2).replace(".", ",")}</span>
              </div>
              <div className="co-summary-row">
                <span>Entrega</span>
                <span>R$ {DELIVERY.toFixed(2).replace(".", ",")}</span>
              </div>
            </div>

            <div className="co-total-row">
              <span className="co-total-label">Total</span>
              <span className="co-total-value">
                R$ {(cartTotal + DELIVERY).toFixed(2).replace(".", ",")}
              </span>
            </div>

            <button
              className="co-cta"
              onClick={handleConfirmOrder}
              disabled={loading}
            >
              {loading ? "Processando..." : "Confirmar Pedido →"}
            </button>
            <div className="co-secure">🔒 Pagamento 100% seguro</div>
          </div>
        </div>
      </div>

      {/* ── BOTÃO FIXO MOBILE ── */}
      <div className="co-cta-wrap">
        <button
          className="co-cta"
          onClick={handleConfirmOrder}
          disabled={loading}
        >
          {loading ? "Processando..." : "Confirmar Pedido →"}
        </button>
        <div className="co-secure">🔒 Pagamento 100% seguro</div>
      </div>
    </div>
  );
}
