import "./Checkout.css";
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useStoreStatus, useStoreHoursData } from "../../shared/context/useStoreStatus";
import { useCheckoutForm } from "./hooks/useCheckoutForm";
import { useOnlinePaymentConfig } from "./hooks/useOnlinePaymentConfig";
import { PAYMENT_METHODS } from "../../shared/utils/paymentMethods";
import { deliveryPaymentOptions } from "./checkoutConstants";
import DeliveryFields from "./components/DeliveryFields";
import PaymentMethodSection from "./components/PaymentMethodSection";
import OrderSummaryCard from "./components/OrderSummaryCard";
import ConfirmCta from "./components/ConfirmCta";

export default function Checkout({ user, clearCart }) {
  const navigate = useNavigate();
  const location = useLocation();

  const cartItems = location.state?.cartItems ?? [];
  const cartTotal = location.state?.cartTotal ?? 0;
  const DELIVERY = location.state?.frete ?? 0;
  const isRetirada = location.state?.isRetirada ?? false;
  const bairroCarrinho = location.state?.bairro ?? "";

  const storeStatus = useStoreStatus();
  const closed = !storeStatus.open;

  const hoursData = useStoreHoursData();
  const enabledMethods = hoursData?.config?.payment_methods_enabled;
  const isMethodEnabled = (value) => enabledMethods?.[value] !== false;
  // store_config.credit_installment_fee_rate é a fonte de verdade agora
  // (fallback pro valor fixo enquanto hoursData ainda não carregou) — o
  // servidor recalcula tudo de novo por segurança, isso aqui é só pra
  // mostrar o total certo antes de confirmar.
  const installmentFeeRate = hoursData?.config?.credit_installment_fee_rate;

  const {
    errorRef, payment, setPayment, installments, setInstallments,
    baseTotal, cardFee, finalTotal, errorMsg, setErrorMsg,
    cep, cepLoading, cepError, address, lastAddress, lastAddressMessage,
    handleAddressChange, handleCepChange, handleCepBlur, handlePhoneChange,
    handleUseLastAddress, handleConfirmOrder,
    isDisabled, phoneDigits, cepDigits, ctaLabel,
  } = useCheckoutForm({
    user, cartItems, cartTotal, DELIVERY, isRetirada, bairroCarrinho, clearCart, navigate,
    installmentFeeRate,
  });

  // Pagamento online: só aparece se a loja configurou a InfinitePay
  const onlineConfig = useOnlinePaymentConfig();
  const onlineOptions = onlineConfig.infinitepay
    ? [{ value: "infinitepay", icon: PAYMENT_METHODS.infinitepay.icon, name: "Pix ou cartão em até 12x", wide: true }]
    : [];

  // Se a forma selecionada foi desligada pelo admin enquanto o cliente
  // estava na tela (ou já veio desligada), troca pra primeira disponível
  // em vez de deixar o checkout "preso" numa opção que sumiu da grade.
  useEffect(() => {
    if (!onlineConfig.loaded) return; // espera saber se tem pagamento online
    const available = [...onlineOptions, ...deliveryPaymentOptions].filter((opt) => isMethodEnabled(opt.value));
    if (available.some((opt) => opt.value === payment)) return;
    if (available[0]) setPayment(available[0].value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledMethods, onlineConfig.loaded, onlineConfig.infinitepay]);

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
                    {lastAddress.complement ? ` - ${lastAddress.complement}` : ""}{" "}
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
              <div className="co-last-location-feedback">{lastAddressMessage}</div>
            )}

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
              <DeliveryFields
                address={address}
                handleAddressChange={handleAddressChange}
                cep={cep}
                handleCepChange={handleCepChange}
                handleCepBlur={handleCepBlur}
                cepLoading={cepLoading}
                cepError={cepError}
                bairroCarrinho={bairroCarrinho}
                isDisabled={isDisabled}
                errorMsg={errorMsg}
                cepDigits={cepDigits}
              />
            )}

            <PaymentMethodSection
              payment={payment}
              setPayment={setPayment}
              installments={installments}
              setInstallments={setInstallments}
              isDisabled={isDisabled}
              baseTotal={baseTotal}
              onlineOptions={onlineOptions}
              enabledMethods={enabledMethods}
              installmentFeeRate={installmentFeeRate}
            />
          </div>

          {/* ── SUMMARY ── */}
          <OrderSummaryCard
            cartItems={cartItems}
            cartTotal={cartTotal}
            DELIVERY={DELIVERY}
            isRetirada={isRetirada}
            payment={payment}
            cardFee={cardFee}
            installments={installments}
            finalTotal={finalTotal}
            ctaLabel={ctaLabel}
            onConfirm={handleConfirmOrder}
            isDisabled={isDisabled}
            closed={closed}
          />
        </div>
      </div>

      {/* ── BOTÃO FIXO MOBILE ── */}
      <div className="co-cta-wrap">
        <ConfirmCta label={ctaLabel} onClick={handleConfirmOrder} disabled={isDisabled || closed} />
      </div>
    </div>
  );
}
