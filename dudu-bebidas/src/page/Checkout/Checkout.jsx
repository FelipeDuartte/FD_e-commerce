import { useEffect, useState, useRef } from "react";
import "./Checkout.css";
import { imgProduto } from "../../utils/Cloudnary";
import { useNavigate, useLocation } from "react-router-dom";
import { saveOrder } from "../../supabase/saveOrder";
import { useStoreStatus } from "../../context/StoreStatusContext";
import {
  loadLastDeliveryAddress,
  saveLastDeliveryAddress,
} from "../../utils/checkoutAddressStorage";

const paymentOptions = [
  { value: "pix", icon: "⚡", name: "PIX" },
  { value: "debit_card", icon: "💳", name: "Débito" },
  { value: "credit_card", icon: "💳", name: "Crédito" },
  { value: "cash", icon: "💵", name: "Dinheiro" },
];

// Pagamento é feito na entrega (maquininha do entregador) — isso só define
// em quantas vezes o cliente PRETENDE parcelar, pra facilitar quem vai
// levar a máquina certa. Ajuste o máximo aqui se seu maquininha permitir mais.
const MAX_INSTALLMENTS = 8;
const INSTALLMENT_OPTIONS = Array.from({ length: MAX_INSTALLMENTS }, (_, i) => i + 1);

// Taxas reais da maquininha (crédito), tiradas direto do visor dela.
// Mesmo "à vista" (1x) tem taxa — é assim que a máquina cobra. Parado em 8x
// porque foi até onde deu pra ler no print com certeza (9x tinha um dígito
// tampado) — manda o resto que eu completo a tabela.
// Se a taxa da maquininha mudar um dia, é só atualizar aqui (e no mesmo
// objeto dentro da Edge Function create-order, que recalcula o total
// de novo no servidor por segurança).
const INSTALLMENT_FEE_RATE = {
  1: 0.0326,
  2: 0.057,
  3: 0.0652,
  4: 0.0736,
  5: 0.0819,
  6: 0.0903,
  7: 0.0988,
  8: 0.1073,
};

const roundCents = (v) => Math.round(v * 100) / 100;

function applyCreditCardFee(baseTotal, payment, installments) {
  if (payment !== "credit_card") return baseTotal;
  const rate = INSTALLMENT_FEE_RATE[installments] ?? 0;
  return roundCents(baseTotal * (1 + rate));
}

const INITIAL_ADDRESS = {
  name: "",
  phone: "",
  street: "",
  number: "",
  district: "",
  complement: "",
  city: "",
  state: "",
};

export default function Checkout({ user, clearCart }) {
  const navigate = useNavigate();
  const location = useLocation();
  const errorRef = useRef(null);

  const cartItems = location.state?.cartItems ?? [];
  const cartTotal = location.state?.cartTotal ?? 0;
  const DELIVERY = location.state?.frete ?? 0;
  const isRetirada = location.state?.isRetirada ?? false;
  const bairroCarrinho = location.state?.bairro ?? "";

  const isProcessingRef = useRef(false);
  const [orderProcessed, setOrderProcessed] = useState(false);
  const [payment, setPayment] = useState("pix");
  const [installments, setInstallments] = useState(1);

  // Total já com a taxa da maquininha embutida (só quando for crédito)
  const baseTotal = cartTotal + DELIVERY;
  const cardFee = payment === "credit_card"
    ? roundCents(baseTotal * (INSTALLMENT_FEE_RATE[installments] ?? 0))
    : 0;
  const finalTotal = baseTotal + cardFee;
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [cep, setCep] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");

  const [address, setAddress] = useState(INITIAL_ADDRESS);
  const [lastAddress, setLastAddress] = useState(null);
  const [lastAddressMessage, setLastAddressMessage] = useState("");

  // ── Helpers ───────────────────────────────────────────
  const showError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => {
      if (errorRef.current) {
        errorRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
        errorRef.current.classList.add("co-error-highlight");
        setTimeout(
          () => errorRef.current?.classList.remove("co-error-highlight"),
          2000,
        );
      }
    }, 100);
  };

  // ── Effects ───────────────────────────────────────────
  useEffect(() => {
    if (cartItems.length === 0) navigate("/", { replace: true });
  }, [cartItems.length, navigate]);

  useEffect(() => {
    if (!orderProcessed) return;
    const handlePopState = () => navigate("/", { replace: true });
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [orderProcessed, navigate]);

  useEffect(() => {
    if (!user?.id || isRetirada) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastAddress(null);
      return;
    }

    const savedAddress = loadLastDeliveryAddress(user.id);
    const sameDeliveryArea =
      savedAddress &&
      (!savedAddress.bairro || savedAddress.bairro === bairroCarrinho);

    setLastAddress(sameDeliveryArea ? savedAddress : null);
  }, [bairroCarrinho, isRetirada, user?.id]);

  // ── Handlers ──────────────────────────────────────────
  const handleAddressChange = (e) => {
    setAddress((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setLastAddressMessage("");
    if (errorMsg) setErrorMsg("");
  };

  const handleCepChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 8);
    setCep(value.length > 5 ? `${value.slice(0, 5)}-${value.slice(5)}` : value);
    setCepError("");
    setLastAddressMessage("");
    if (errorMsg) setErrorMsg("");
  };

  const handleCepBlur = async () => {
    const cleaned = cep.replace(/\D/g, "");
    if (cleaned.length !== 8) {
      setCepError("CEP inválido. Digite 8 números.");
      return;
    }
    setCepLoading(true);
    setCepError("");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
      const data = await res.json();
      if (data.erro) {
        setCepError("CEP não encontrado.");
        setCepLoading(false);
        return;
      }
      setAddress((prev) => ({
        ...prev,
        street: data.logradouro || prev.street,
        district: data.bairro || prev.district,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }));
    } catch {
      setCepError("Erro ao buscar CEP.");
    }
    setCepLoading(false);
  };

  const handlePhoneChange = (e) => {
    let value = e.target.value.replace(/\D/g, "").slice(0, 11);
    if (value.length > 6)
      value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    else if (value.length > 2)
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    setAddress((prev) => ({ ...prev, phone: value }));
    setLastAddressMessage("");
    if (errorMsg) setErrorMsg("");
  };

  const handleUseLastAddress = () => {
    if (!lastAddress) return;

    setAddress({
      ...INITIAL_ADDRESS,
      ...lastAddress,
    });
    setCep(lastAddress.cep ?? "");
    setCepError("");
    setErrorMsg("");
    setLastAddressMessage("Ultima localizacao aplicada.");
  };

  // ── Validação ─────────────────────────────────────────
  const validateForm = () => {
    if (!address.name.trim()) return "Por favor, informe seu nome.";

    const phoneDigits = address.phone.replace(/\D/g, "");
    if (!phoneDigits || phoneDigits.length < 10)
      return "Por favor, informe um telefone válido com DDD.";

    if (isRetirada) return null;

    const cepDigits = cep.replace(/\D/g, "");
    if (cepDigits.length !== 8) return "Por favor, informe um CEP válido.";
    if (cepError) return "Por favor, verifique o CEP informado.";
    if (!address.street.trim()) return "Por favor, informe o endereço.";
    if (!address.number.trim()) return "Por favor, informe o número.";
    if (!address.district.trim()) return "Por favor, informe o bairro.";

    return null;
  };

  // ── Submit ────────────────────────────────────────────
  const handleConfirmOrder = async () => {
    if (isProcessingRef.current || orderProcessed || loading) return;
    setErrorMsg("");

    const validationError = validateForm();
    if (validationError) {
      showError(validationError);
      return;
    }

    if (cartItems.length === 0) {
      showError("Seu carrinho está vazio.");
      return;
    }

    isProcessingRef.current = true;
    setLoading(true);

    try {
      const addressToSave = isRetirada
        ? { name: address.name, phone: address.phone, isRetirada: true }
        : { ...address, cep, bairro: bairroCarrinho };

      const { orderId, error } = await saveOrder({
        userId: user?.id ?? null,
        total: finalTotal,
        deliveryFee: DELIVERY,
        paymentMethod: payment,
        installments: payment === "credit_card" ? installments : null,
        address: addressToSave,
        cartItems,
      });

      if (error) {
        showError(error);
        isProcessingRef.current = false;
        setLoading(false);
        return;
      }

      if (user?.id && !isRetirada) {
        saveLastDeliveryAddress(user.id, addressToSave);
      }

      setOrderProcessed(true);
      clearCart();
      navigate("/confirmacao", {
        state: {
          orderId,
          cartItems,
          total: finalTotal,
          payment,
          installments: payment === "credit_card" ? installments : null,
          address: addressToSave,
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
  const isDisabled = loading || orderProcessed;
  const phoneDigits = address.phone.replace(/\D/g, "");
  const cepDigits = cep.replace(/\D/g, "");

  const ctaLabel = loading
    ? "Processando..."
    : orderProcessed
      ? "Confirmado ✓"
      : isRetirada
        ? "Confirmar Retirada →"
        : "Confirmar Pedido →";

  // ── Render ────────────────────────────────────────────
  const storeStatus = useStoreStatus();
  const closed = !storeStatus.open;
  return (
    <div className="co-root">
      <div className="co-wrap">
        {closed && (
          <div className="co-error-alert">
            <div className="co-error-icon">⚠️</div>
            <div className="co-error-content">
              <div className="co-error-title">Loja fechada</div>
              <div className="co-error-message">{storeStatus.message}</div>
            </div>
          </div>
        )}

        {/* ── HEADER ── */}
        <div className="co-header">
          <button
            className="co-back"
            onClick={() => {
              if (!isDisabled) navigate("/", { state: { openCart: true } });
            }}
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
            <span className="co-prog-label">
              {isRetirada ? "Retirada" : "Checkout"}
            </span>
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
                  <span>
                    Seu pedido ficará pronto para retirada assim que confirmado.
                  </span>
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

            {lastAddress && !isRetirada && (
              <div className="co-last-location">
                <div className="co-last-location-copy">
                  <strong>Ultima localizacao</strong>
                  <span>
                    {lastAddress.street}, {lastAddress.number}
                    {lastAddress.complement
                      ? ` - ${lastAddress.complement}`
                      : ""}{" "}
                    · {lastAddress.district}
                  </span>
                </div>
                <button
                  type="button"
                  className="co-last-location-btn"
                  onClick={handleUseLastAddress}
                  disabled={isDisabled}
                >
                  Usar
                </button>
              </div>
            )}

            {lastAddressMessage && (
              <div className="co-last-location-feedback">
                {lastAddressMessage}
              </div>
            )}

            <div className="co-field-row">
              <div className="co-field">
                <label>Nome completo</label>
                <input
                  type="text"
                  name="name"
                  value={address.name}
                  onChange={handleAddressChange}
                  placeholder={
                    isRetirada
                      ? "Seu nome para retirada"
                      : "Seu nome e sobrenome"
                  }
                  disabled={isDisabled}
                  className={
                    errorMsg && !address.name.trim() ? "co-input-error" : ""
                  }
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
                  className={
                    errorMsg && phoneDigits.length < 10 ? "co-input-error" : ""
                  }
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
                        className={
                          cepError || (errorMsg && cepDigits.length !== 8)
                            ? "co-input-error"
                            : ""
                        }
                        disabled={isDisabled}
                      />
                      {cepLoading && <span className="co-cep-loading">🔍</span>}
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
                      disabled={isDisabled}
                      className={
                        errorMsg && !address.number.trim()
                          ? "co-input-error"
                          : ""
                      }
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
                      className={
                        errorMsg && !address.street.trim()
                          ? "co-input-error"
                          : ""
                      }
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
                      className={
                        errorMsg && !address.district.trim()
                          ? "co-input-error"
                          : ""
                      }
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
                    onChange={() => {
                      setPayment(opt.value);
                      if (opt.value !== "credit_card") setInstallments(1);
                    }}
                    disabled={isDisabled}
                  />
                  <label className="co-pay-label" htmlFor={opt.value}>
                    <span className="co-pay-icon">{opt.icon}</span>
                    <span className="co-pay-name">{opt.name}</span>
                  </label>
                </div>
              ))}
            </div>

            {payment === "credit_card" && (
              <div className="co-installments">
                <label htmlFor="co-installments-select" className="co-installments-label">
                  Em quantas vezes?
                </label>
                <select
                  id="co-installments-select"
                  className="co-installments-select"
                  value={installments}
                  onChange={(e) => setInstallments(Number(e.target.value))}
                  disabled={isDisabled}
                >
                  {INSTALLMENT_OPTIONS.map((n) => {
                    const optTotal = applyCreditCardFee(baseTotal, "credit_card", n);
                    const perInstallment = optTotal / n;
                    return (
                      <option key={n} value={n}>
                        {n}x {n === 1 ? "à vista" : `de R$ ${perInstallment.toFixed(2).replace(".", ",")}`}
                        {" "}— total R$ {optTotal.toFixed(2).replace(".", ",")}
                      </option>
                    );
                  })}
                </select>
                <p className="co-installments-hint">
                  O valor já inclui a taxa da maquininha pra cada opção. 💳
                </p>
              </div>
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
                      {item.icon ? (
                        <img
                          src={imgProduto(item.icon)}
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
                <span>{isRetirada ? "Retirada" : "Entrega"}</span>
                <span>
                  {DELIVERY === 0
                    ? "GRÁTIS"
                    : `R$ ${DELIVERY.toFixed(2).replace(".", ",")}`}
                </span>
              </div>
              {payment === "credit_card" && cardFee > 0 && (
                <div className="co-summary-row co-summary-row-fee">
                  <span>Taxa da maquininha ({installments}x)</span>
                  <span>+ R$ {cardFee.toFixed(2).replace(".", ",")}</span>
                </div>
              )}
            </div>

            <div className="co-total-row">
              <span className="co-total-label">Total</span>
              <span className="co-total-value">
                R$ {(finalTotal).toFixed(2).replace(".", ",")}
              </span>
            </div>

            <button
              className="co-cta"
              onClick={handleConfirmOrder}
              disabled={isDisabled || closed}
            >
              {ctaLabel}
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
          disabled={isDisabled || closed}
        >
          {ctaLabel}
        </button>
        <div className="co-secure">🔒 Pagamento 100% seguro</div>
      </div>
    </div>
  );
}