import { useEffect, useState } from "react";
import "./Checkout.css";
import { useNavigate, useLocation } from "react-router-dom";
import { saveOrder } from "../../supabase/saveOrder";

const paymentOptions = [
  { value: "pix",  icon: "⚡", name: "PIX"      },
  { value: "card", icon: "💳", name: "Cartão"   },
  { value: "cash", icon: "💵", name: "Dinheiro" },
];

// ── Bairros permitidos para entrega ───────────────────
const BAIRROS_PERMITIDOS = [
  "minas caixas",
  "serra verde",
  "parque são pedro",
  "parque sao pedro",
  "venda nova",
];

export default function Checkout({ user }) {
  const navigate = useNavigate();
  const location = useLocation();

  const cartItems = location.state?.cartItems ?? [];
  const cartTotal = location.state?.cartTotal ?? 0;
  const DELIVERY  = location.state?.frete ?? 5;

  // ── Redireciona se carrinho vazio ─────────────────
  useEffect(() => {
    if (cartItems.length === 0) {
      navigate("/", { replace: true });
    }
  }, []);

  const [payment, setPayment]   = useState("pix");
  const [loading, setLoading]   = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // ── CEP ───────────────────────────────────────────
  const [cep, setCep]             = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError]   = useState("");

  const [address, setAddress] = useState({
    name:       "",
    phone:      "",
    street:     "",
    number:     "",
    district:   "",
    complement: "",
    city:       "",
    state:      "",
  });

  const handleAddressChange = (e) => {
    setAddress((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // ── Busca CEP na API ViaCEP ───────────────────────
  const handleCepBlur = async () => {
    const cleaned = cep.replace(/\D/g, "");
    if (cleaned.length !== 8) {
      setCepError("CEP inválido. Digite 8 números.");
      return;
    }

    setCepLoading(true);
    setCepError("");

    try {
      const res  = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
      const data = await res.json();

      if (data.erro) {
        setCepError("CEP não encontrado. Verifique e tente novamente.");
        setCepLoading(false);
        return;
      }

      // Preenche os campos automaticamente
      setAddress((prev) => ({
        ...prev,
        street:   data.logradouro || prev.street,
        district: data.bairro     || prev.district,
        city:     data.localidade || prev.city,
        state:    data.uf         || prev.state,
      }));

    } catch {
      setCepError("Erro ao buscar CEP. Verifique sua conexão.");
    }

    setCepLoading(false);
  };

  // ── Formata CEP com máscara ───────────────────────
  const handleCepChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 8);
    const formatted = value.length > 5
      ? `${value.slice(0, 5)}-${value.slice(5)}`
      : value;
    setCep(formatted);
    setCepError("");
  };

  // ── Formata telefone com máscara ──────────────────
  const handlePhoneChange = (e) => {
    let value = e.target.value.replace(/\D/g, "").slice(0, 11);
    if (value.length > 6) {
      value = `(${value.slice(0,2)}) ${value.slice(2,7)}-${value.slice(7)}`;
    } else if (value.length > 2) {
      value = `(${value.slice(0,2)}) ${value.slice(2)}`;
    }
    setAddress((prev) => ({ ...prev, phone: value }));
  };

  // ── Validação completa ────────────────────────────
  const validateForm = () => {
    if (!address.name.trim())
      return "Por favor, informe seu nome completo.";

    if (address.name.trim().split(" ").length < 2)
      return "Por favor, informe nome e sobrenome.";

    const phoneClean = address.phone.replace(/\D/g, "");
    if (!phoneClean || phoneClean.length < 10)
      return "Por favor, informe um telefone válido com DDD.";

    const cepClean = cep.replace(/\D/g, "");
    if (cepClean.length !== 8)
      return "Por favor, informe um CEP válido.";

    if (cepError)
      return "Por favor, verifique o CEP informado.";

    if (!address.street.trim())
      return "Por favor, informe o endereço.";

    if (!address.number.trim())
      return "Por favor, informe o número.";

    if (!address.district.trim())
      return "Por favor, informe o bairro.";

    // Valida se o bairro é atendido
    const bairroNorm = address.district.trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const atendido = BAIRROS_PERMITIDOS.some((b) =>
      bairroNorm.includes(b.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
    );

    if (!atendido)
      return `Infelizmente não entregamos neste bairro. Atendemos: Minas Caixas, Serra Verde, Parque São Pedro e Venda Nova.`;

    return null;
  };

  // ── Confirmar pedido ──────────────────────────────
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
      userId:        user.id,
      total:         cartTotal + DELIVERY,
      paymentMethod: payment,
      address:       { ...address, cep },
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
        address: { ...address, cep },
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

            {errorMsg && (
              <div className="co-error-msg">⚠️ {errorMsg}</div>
            )}

            {/* Nome + Telefone */}
            <div className="co-field-row">
              <div className="co-field">
                <label>Nome completo</label>
                <input
                  type="text"
                  name="name"
                  value={address.name}
                  onChange={handleAddressChange}
                  placeholder="Seu nome e sobrenome"
                />
              </div>
              <div className="co-field">
                <label>Telefone</label>
                <input
                  type="tel"
                  name="phone"
                  value={address.phone}
                  onChange={handlePhoneChange}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            {/* CEP */}
            <div className="co-field-row">
              <div className="co-field">
                <label>CEP</label>
                <div className="co-cep-wrap">
                  <input
                    type="text"
                    value={cep}
                    onChange={handleCepChange}
                    onBlur={handleCepBlur}
                    placeholder="00000-000"
                    maxLength={9}
                    className={cepError ? "co-input-error" : ""}
                  />
                  {cepLoading && (
                    <span className="co-cep-loading">🔍</span>
                  )}
                </div>
                {cepError && (
                  <span className="co-field-error">{cepError}</span>
                )}
                {!cepError && address.city && (
                  <span className="co-field-success">
                    ✓ {address.city} — {address.state}
                  </span>
                )}
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

            {/* Endereço — preenchido pelo CEP */}
            <div className="co-field-row single">
              <div className="co-field">
                <label>Endereço</label>
                <input
                  type="text"
                  name="street"
                  value={address.street}
                  onChange={handleAddressChange}
                  placeholder="Rua / Av. — preenchido pelo CEP"
                />
              </div>
            </div>

            {/* Bairro + Complemento */}
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

            {/* Aviso de bairros atendidos */}
            <div className="co-bairros-info">
              📍 Entregamos em: Minas Caixas, Serra Verde, Parque São Pedro e Venda Nova
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
              {cartItems.length === 0 ? (
                <p className="co-empty-msg">Nenhum item no carrinho.</p>
              ) : (
                cartItems.map((item, i) => (
                  <div className="co-item" key={i}>
                    <div className="co-item-icon">
                      {item.icon ? (
                        <img
                          src={item.icon}
                          alt={item.name}
                          style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6 }}
                        />
                      ) : "🛒"}
                    </div>
                    <div className="co-item-info">
                      <div className="co-item-name">{item.name}</div>
                      <div className="co-item-qty">{item.quantity} unidade(s)</div>
                    </div>
                    <div className="co-item-price">
                      R$ {(item.price * item.quantity).toFixed(2).replace(".", ",")}
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