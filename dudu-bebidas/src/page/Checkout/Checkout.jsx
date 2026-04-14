import { useEffect, useState, useRef } from "react";
import "./Checkout.css";
import { useNavigate, useLocation } from "react-router-dom";
import { saveOrder } from "../../supabase/saveOrder";

const paymentOptions = [
  { value: "pix",  icon: "⚡", name: "PIX"      },
  { value: "card", icon: "💳", name: "Cartão"   },
  { value: "cash", icon: "💵", name: "Dinheiro" },
];

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

  const cartItems  = location.state?.cartItems  ?? [];
  const cartTotal  = location.state?.cartTotal  ?? 0;
  const DELIVERY   = location.state?.frete      ?? 0;
  const isRetirada = location.state?.isRetirada ?? false;

  const isProcessingRef              = useRef(false);
  const [orderProcessed, setOrderProcessed] = useState(false);
  const [payment, setPayment]               = useState("pix");
  const [loading, setLoading]               = useState(false);
  const [errorMsg, setErrorMsg]             = useState("");

  // ── Endereço — só usado para entregas ────────────
  const [cep, setCep]               = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError]     = useState("");

  const [address, setAddress] = useState({
    name: "", phone: "", street: "",
    number: "", district: "", complement: "",
    city: "", state: "",
  });

  // Resetar campos quando mudar para retirada
  useEffect(() => {
    if (isRetirada) {
      setCep("");
      setCepError("");
      setAddress(prev => ({
        ...prev,
        street: "",
        number: "",
        district: "",
        complement: "",
        city: "",
        state: "",
      }));
    }
  }, [isRetirada]);

  useEffect(() => {
    if (cartItems.length === 0) navigate("/", { replace: true });
  }, [cartItems, navigate]);

  useEffect(() => {
    if (orderProcessed) {
      const handlePopState = () => { if (orderProcessed) navigate("/", { replace: true }); };
      window.addEventListener("popstate", handlePopState);
      return () => window.removeEventListener("popstate", handlePopState);
    }
  }, [orderProcessed, navigate]);

  const handleAddressChange = (e) => {
    setAddress((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCepBlur = async () => {
    const cleaned = cep.replace(/\D/g, "");
    if (cleaned.length !== 8) { setCepError("CEP inválido. Digite 8 números."); return; }
    setCepLoading(true); setCepError("");
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
    } catch { setCepError("Erro ao buscar CEP."); }
    setCepLoading(false);
  };

  const handleCepChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 8);
    setCep(value.length > 5 ? `${value.slice(0,5)}-${value.slice(5)}` : value);
    setCepError("");
  };

  const handlePhoneChange = (e) => {
    let value = e.target.value.replace(/\D/g, "").slice(0, 11);
    if (value.length > 6)      value = `(${value.slice(0,2)}) ${value.slice(2,7)}-${value.slice(7)}`;
    else if (value.length > 2) value = `(${value.slice(0,2)}) ${value.slice(2)}`;
    setAddress((prev) => ({ ...prev, phone: value }));
  };

  // ── Validação ────────────────────────────────────
  const validateForm = () => {
    if (isRetirada) {
      // Retirada - só valida nome e telefone
      if (!address.name || address.name.trim() === "") {
        return "Por favor, informe seu nome para identificação.";
      }
      const phoneClean = address.phone.replace(/\D/g, "");
      if (!phoneClean || phoneClean.length < 10) {
        return "Por favor, informe um telefone válido para contato (mínimo 10 dígitos).";
      }
      return null;
    }

    // Entrega — validação completa
    const phoneClean = address.phone.replace(/\D/g, "");
    if (!phoneClean || phoneClean.length < 10)
      return "Por favor, informe um telefone válido com DDD.";
    const cepClean = cep.replace(/\D/g, "");
    if (cepClean.length !== 8) return "Por favor, informe um CEP válido.";
    if (cepError)               return "Por favor, verifique o CEP informado.";
    if (!address.street.trim()) return "Por favor, informe o endereço.";
    if (!address.number.trim()) return "Por favor, informe o número.";
    if (!address.district.trim()) return "Por favor, informe o bairro.";
    const bairroNorm = address.district.trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const atendido = BAIRROS_PERMITIDOS.some((b) =>
      bairroNorm.includes(b.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
    );
    if (!atendido)
      return "Infelizmente não entregamos neste bairro. Atendemos: Minas Caixas, Serra Verde, Parque São Pedro e Venda Nova.";
    return null;
  };

  const handleConfirmOrder = async () => {
    if (isProcessingRef.current || orderProcessed || loading) return;
    setErrorMsg("");

    if (!user) { setErrorMsg("login_required"); return; }

    const validationError = validateForm();
    if (validationError) { setErrorMsg(validationError); return; }
    if (cartItems.length === 0) { setErrorMsg("Seu carrinho está vazio."); return; }

    isProcessingRef.current = true;
    setLoading(true);

    try {
      const addressToSave = isRetirada
        ? { name: address.name, phone: address.phone, isRetirada: true }
        : { ...address, cep };

      const { orderId, error } = await saveOrder({
        userId:        user.id,
        total:         cartTotal + DELIVERY,
        paymentMethod: payment,
        address:       addressToSave,
        cartItems,
      });

      if (error) {
        setErrorMsg(error);
        isProcessingRef.current = false;
        setLoading(false);
        return;
      }

      setOrderProcessed(true);

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
      setErrorMsg("Ocorreu um erro ao processar seu pedido. Tente novamente.");
      isProcessingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="co-root">
      <div className="co-wrap">

        {/* ── HEADER ── */}
        <div className="co-header">
          <button
            className="co-back"
            onClick={() => { if (!orderProcessed && !loading) navigate("/", { state: { openCart: true } }); }}
            disabled={loading || orderProcessed}
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

        {/* ── BANNER DE LOGIN ── */}
        {!user && (
          <div className="co-login-banner">
            <div className="co-login-banner-icon">🔐</div>
            <div className="co-login-banner-text">
              <strong>Faça login para continuar</strong>
              <span>É necessário estar logado para finalizar seu pedido.</span>
            </div>
            <button
              className="co-login-banner-btn"
              onClick={() => navigate("/", { state: { openLogin: true } })}
            >
              Entrar
            </button>
          </div>
        )}

        <div className="co-grid">

          {/* ── FORM ── */}
          <div className={`co-card${!user ? " co-card-locked" : ""}`}>
            
            {isRetirada ? (
              /* ── FORMULÁRIO SIMPLIFICADO PARA RETIRADA ── */
              <>
                <div className="co-retirada-banner">
                  <span className="co-retirada-icon">🏪</span>
                  <div className="co-retirada-text">
                    <strong>Retirada na Loja</strong>
                    <span>Seu pedido ficará pronto para retirada assim que confirmado.</span>
                  </div>
                </div>

                <div className="co-section-label">👤 Identificação</div>

                {errorMsg && errorMsg !== "login_required" && (
                  <div className="co-error-msg">⚠️ {errorMsg}</div>
                )}

                <div className="co-field">
                  <label>Nome completo *</label>
                  <input
                    type="text"
                    name="name"
                    value={address.name}
                    onChange={handleAddressChange}
                    placeholder="Seu nome para retirada"
                    disabled={loading || orderProcessed || !user}
                  />
                </div>

                <div className="co-field">
                  <label>Telefone para contato *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={address.phone}
                    onChange={handlePhoneChange}
                    placeholder="(00) 00000-0000"
                    disabled={loading || orderProcessed || !user}
                  />
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
                        disabled={loading || orderProcessed || !user}
                      />
                      <label className="co-pay-label" htmlFor={opt.value}>
                        <span className="co-pay-icon">{opt.icon}</span>
                        <span className="co-pay-name">{opt.name}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              /* ── FORMULÁRIO COMPLETO PARA ENTREGA ── */
              <>
                <div className="co-section-label">📍 Entrega</div>

                {errorMsg && errorMsg !== "login_required" && (
                  <div className="co-error-msg">⚠️ {errorMsg}</div>
                )}

                <div className="co-field-row">
                  <div className="co-field">
                    <label>Nome completo</label>
                    <input
                      type="text"
                      name="name"
                      value={address.name}
                      onChange={handleAddressChange}
                      placeholder="Seu nome e sobrenome"
                      disabled={loading || orderProcessed || !user}
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
                      disabled={loading || orderProcessed || !user}
                    />
                  </div>
                </div>

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
                        disabled={loading || orderProcessed || !user}
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
                      disabled={loading || orderProcessed || !user}
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
                      disabled={loading || orderProcessed || !user}
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
                      disabled={loading || orderProcessed || !user}
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
                      disabled={loading || orderProcessed || !user}
                    />
                  </div>
                </div>

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
                        disabled={loading || orderProcessed || !user}
                      />
                      <label className="co-pay-label" htmlFor={opt.value}>
                        <span className="co-pay-icon">{opt.icon}</span>
                        <span className="co-pay-name">{opt.name}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </>
            )}
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

            <button
              className="co-cta"
              onClick={handleConfirmOrder}
              disabled={loading || orderProcessed}
            >
              {loading        ? "Processando..."
               : orderProcessed ? "Confirmado ✓"
               : !user         ? "🔐 Entre para continuar"
               : isRetirada    ? "Confirmar Retirada →"
               : "Confirmar Pedido →"}
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
          disabled={loading || orderProcessed}
        >
          {loading        ? "Processando..."
           : orderProcessed ? "Confirmado ✓"
           : !user         ? "🔐 Entre para continuar"
           : isRetirada    ? "Confirmar Retirada →"
           : "Confirmar Pedido →"}
        </button>
        <div className="co-secure">🔒 Pagamento 100% seguro</div>
      </div>
    </div>
  );
}