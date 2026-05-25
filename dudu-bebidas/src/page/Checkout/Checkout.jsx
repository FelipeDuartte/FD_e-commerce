import { useEffect, useState, useRef } from "react";
import "./Checkout.css";
import { useNavigate, useLocation } from "react-router-dom";
import { saveOrder } from "../../supabase/saveOrder";
import { isStoreOpen } from "../../utils/storeHours";

const paymentOptions = [
  { value: "pix",  icon: "⚡", name: "PIX"      },
  { value: "card", icon: "💳", name: "Cartão"   },
  { value: "cash", icon: "💵", name: "Dinheiro" },
];

const INITIAL_ADDRESS = {
  name: "", phone: "", street: "",
  number: "", district: "", complement: "",
  city: "", state: "",
};

export default function Checkout({ user, clearCart }) {
  const navigate = useNavigate();
  const location = useLocation();
  const errorRef = useRef(null);

  const cartItems      = location.state?.cartItems  ?? [];
  const cartTotal      = location.state?.cartTotal  ?? 0;
  const DELIVERY       = location.state?.frete      ?? 0;
  const isRetirada     = location.state?.isRetirada ?? false;
  const bairroCarrinho = location.state?.bairro     ?? "";

  const isProcessingRef                     = useRef(false);
  const [orderProcessed, setOrderProcessed] = useState(false);
  const [payment, setPayment]               = useState("pix");
  const [loading, setLoading]               = useState(false);
  const [errorMsg, setErrorMsg]             = useState("");

  const [cep, setCep]               = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError]     = useState("");

  const [address, setAddress] = useState(INITIAL_ADDRESS);

  // ── Helpers ───────────────────────────────────────────
  const showError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => {
      if (errorRef.current) {
        errorRef.current.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        errorRef.current.classList.add("co-error-highlight");
        setTimeout(() => errorRef.current?.classList.remove("co-error-highlight"), 2000);
      }
    }, 100);
  };

  // ── Effects ───────────────────────────────────────────
  useEffect(() => {
    if (cartItems.length === 0) navigate("/", { replace: true });
  }, []);

  useEffect(() => {
    if (!orderProcessed) return;
    const handlePopState = () => navigate("/", { replace: true });
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [orderProcessed, navigate]);

  // ── Handlers ──────────────────────────────────────────
  const handleAddressChange = (e) => {
    setAddress((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (errorMsg) setErrorMsg("");
  };

  const handleCepChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 8);
    setCep(value.length > 5 ? `${value.slice(0, 5)}-${value.slice(5)}` : value);
    setCepError("");
    if (errorMsg) setErrorMsg("");
  };

  const handleCepBlur = async () => {
    const cleaned = cep.replace(/\D/g, "");
    if (cleaned.length !== 8) { setCepError("CEP inválido. Digite 8 números."); return; }
    setCepLoading(true);
    setCepError("");
    try {
      const res  = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
      const data = await res.json();
      if (data.erro) { setCepError("CEP não encontrado."); setCepLoading(false); return; }
      setAddress((prev) => ({
        ...prev,
        street:   data.logradouro || prev.street,
        district: data.bairro     || prev.district,
        city:     data.localidade || prev.city,
        state:    data.uf         || prev.state,
      }));
    } catch {
      setCepError("Erro ao buscar CEP.");
    }
    setCepLoading(false);
  };

  const handlePhoneChange = (e) => {
    let value = e.target.value.replace(/\D/g, "").slice(0, 11);
    if (value.length > 6)      value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    else if (value.length > 2) value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    setAddress((prev) => ({ ...prev, phone: value }));
    if (errorMsg) setErrorMsg("");
  };

  // ── Validação ─────────────────────────────────────────
  const validateForm = () => {
    if (!address.name.trim()) return "Por favor, informe seu nome.";

    const phoneDigits = address.phone.replace(/\D/g, "");
    if (!phoneDigits || phoneDigits.length < 10)
      return "Por favor, informe um telefone válido com DDD.";

    if (isRetirada) return null;

    const cepDigits = cep.replace(/\D/g, "");
    if (cepDigits.length !== 8)   return "Por favor, informe um CEP válido.";
    if (cepError)                 return "Por favor, verifique o CEP informado.";
    if (!address.street.trim())   return "Por favor, informe o endereço.";
    if (!address.number.trim())   return "Por favor, informe o número.";
    if (!address.district.trim()) return "Por favor, informe o bairro.";

    return null;
  };

  // ── Submit ────────────────────────────────────────────
  const handleConfirmOrder = async () => {
    if (isProcessingRef.current || orderProcessed || loading) return;
    setErrorMsg("");

    const validationError = validateForm();
    if (validationError) { showError(validationError); return; }

    if (cartItems.length === 0) { showError("Seu carrinho está vazio."); return; }

    isProcessingRef.current = true;
    setLoading(true);

    try {
      const addressToSave = isRetirada
        ? { name: address.name, phone: address.phone, isRetirada: true }
        : { ...address, cep, bairro: bairroCarrinho };

      const { orderId, error } = await saveOrder({
        userId:        user?.id ?? null,
        total:         cartTotal + DELIVERY,
        paymentMethod: payment,
        address:       addressToSave,
        cartItems,
      });

      if (error) {
        showError(error);
        isProcessingRef.current = false;
        setLoading(false);
        return;
      }

      setOrderProcessed(true);
      clearCart();
      navigate("/confirmacao", {
        state: {
          orderId,
          cartItems,
          total:      cartTotal + DELIVERY,
          payment,
          address:    addressToSave,
          isRetirada,
        },
        replace: true,
      });
    } catch (err) {
      console.error("Erro ao processar pedido:", err);
      showError("Ocorreu um erro ao processar seu pedido. Tente novamente.");
      isProcessingRef.current = false;
      setLoading(false);
    }
  };

  // ── Derivados ─────────────────────────────────────────
  const isDisabled   = loading || orderProcessed;
  const phoneDigits  = address.phone.replace(/\D/g, "");
  const cepDigits    = cep.replace(/\D/g, "");

  const ctaLabel = loading          ? "Processando..."
                 : orderProcessed   ? "Confirmado ✓"
                 : isRetirada       ? "Confirmar Retirada →"
                 :                    "Confirmar Pedido →";

  // ── Render ────────────────────────────────────────────
  const closed = !isStoreOpen();
  return (
    <div className="co-root">
      <div className="co-wrap">

        {closed && (
          <div className="co-error-alert">
            <div className="co-error-icon">⚠️</div>
            <div className="co-error-content">
              <div className="co-error-title">Loja fechada</div>
              <div className="co-error-message">Hoje é segunda-feira — não é possível finalizar pedidos.</div>
            </div>
          </div>
        )}

        {/* ── HEADER ── */}
        <div className="co-header">
          <button
            className="co-back"
            onClick={() => { if (!isDisabled) navigate("/", { state: { openCart: true } }); }}
            disabled={isDisabled}
          >
            ←
          </button>
          <div className="co-header-text">
            <div className="co-step-label">Passo 2 de 2</div>
            <h1 className="co-title">
              {isRetirada ? "Confirmar Retirada" : "Finalizar Pedido"}
            </h1>
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
            <span className="co-prog-label">{isRetirada ? "Retirada" : "Checkout"}</span>
          </div>
          <div className="co-prog-line" />
          <div className="co-prog-step">
            <div className="co-prog-dot inactive">3</div>
            <span className="co-prog-label inactive">Confirmação</span>
          </div>
        </div>

        <div className="co-grid">

          {/* ── FORM ── */}
          <div className="co-card">

            {isRetirada && (
              <div className="co-retirada-banner">
                <span className="co-retirada-icon">🏪</span>
                <div className="co-retirada-text">
                  <strong>Retirada na Loja</strong>
                  <span>Seu pedido ficará pronto para retirada assim que confirmado.</span>
                </div>
              </div>
            )}

            {errorMsg && (
              <div ref={errorRef} className="co-error-alert">
                <div className="co-error-icon">⚠️</div>
                <div className="co-error-content">
                  <div className="co-error-title">Atenção!</div>
                  <div className="co-error-message">{errorMsg}</div>
                </div>
                <button
                  className="co-error-close"
                  onClick={() => setErrorMsg("")}
                  aria-label="Fechar"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="co-section-label">
              {isRetirada ? "👤 Identificação" : "📍 Entrega"}
            </div>

            <div className="co-field-row">
              <div className="co-field">
                <label>Nome completo</label>
                <input
                  type="text"
                  name="name"
                  value={address.name}
                  onChange={handleAddressChange}
                  placeholder={isRetirada ? "Seu nome para retirada" : "Seu nome e sobrenome"}
                  disabled={isDisabled}
                  className={errorMsg && !address.name.trim() ? "co-input-error" : ""}
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
                  disabled={isDisabled}
                  className={errorMsg && phoneDigits.length < 10 ? "co-input-error" : ""}
                />
              </div>
            </div>

            {!isRetirada && (
              <>
                {bairroCarrinho && (
                  <div className="co-bairros-info">
                    📍 Entregando em: <strong>{bairroCarrinho}</strong>
                  </div>
                )}

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
                        className={cepError || (errorMsg && cepDigits.length !== 8) ? "co-input-error" : ""}
                        disabled={isDisabled}
                      />
                      {cepLoading && <span className="co-cep-loading">🔍</span>}
                    </div>
                    {cepError && <span className="co-field-error">{cepError}</span>}
                    {!cepError && address.city && (
                      <span className="co-field-success">✓ {address.city} — {address.state}</span>
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
                      disabled={isDisabled}
                      className={errorMsg && !address.number.trim() ? "co-input-error" : ""}
                    />
                  </div>
                </div>

                <div className="co-field-row single">
                  <div className="co-field">
                    <label>Endereço</label>
                    <input
                      type="text"
                      name="street"
                      value={address.street}
                      onChange={handleAddressChange}
                      placeholder="Rua / Av. — preenchido pelo CEP"
                      disabled={isDisabled}
                      className={errorMsg && !address.street.trim() ? "co-input-error" : ""}
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
                      placeholder="Bairro — preenchido pelo CEP"
                      disabled={isDisabled}
                      className={errorMsg && !address.district.trim() ? "co-input-error" : ""}
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
                      disabled={isDisabled}
                    />
                  </div>
                </div>
              </>
            )}

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
                    disabled={isDisabled}
                  />
                  <label className="co-pay-label" htmlFor={opt.value}>
                    <span className="co-pay-icon">{opt.icon}</span>
                    <span className="co-pay-name">{opt.name}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* ── SUMMARY ── */}
          <div className="co-summary">
            <div className="co-summary-title">Resumo</div>

            <div className="co-items">
              {cartItems.length === 0 ? (
                <p className="co-empty-msg">Nenhum item no carrinho.</p>
              ) : (
                cartItems.map((item, i) => (
                  <div className="co-item" key={i}>
                    <div className="co-item-icon">
                      {item.icon
                        ? <img src={item.icon} alt={item.name} style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6 }} />
                        : "🛒"}
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
                <span>{isRetirada ? "Retirada" : "Entrega"}</span>
                <span>{DELIVERY === 0 ? "GRÁTIS" : `R$ ${DELIVERY.toFixed(2).replace(".", ",")}`}</span>
              </div>
            </div>

            <div className="co-total-row">
              <span className="co-total-label">Total</span>
              <span className="co-total-value">
                R$ {(cartTotal + DELIVERY).toFixed(2).replace(".", ",")}
              </span>
            </div>

            <button className="co-cta" onClick={handleConfirmOrder} disabled={isDisabled || closed}>
              {ctaLabel}
            </button>
            <div className="co-secure">🔒 Pagamento 100% seguro</div>
          </div>
        </div>
      </div>

      {/* ── BOTÃO FIXO MOBILE ── */}
      <div className="co-cta-wrap">
        <button className="co-cta" onClick={handleConfirmOrder} disabled={isDisabled || closed}>
          {ctaLabel}
        </button>
        <div className="co-secure">🔒 Pagamento 100% seguro</div>
      </div>
    </div>
  );
}