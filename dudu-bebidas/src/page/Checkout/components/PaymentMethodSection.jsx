import {
  deliveryPaymentOptions,
  onlinePaymentOptions,
  MAX_INSTALLMENTS,
  INSTALLMENT_OPTIONS,
  applyCreditCardFee,
} from "../checkoutConstants";

function PayOptionGrid({ options, payment, setPayment, setInstallments, isDisabled }) {
  return (
    <div className="co-pay-grid">
      {options.map((opt) => (
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
  );
}

export default function PaymentMethodSection({
  payment, setPayment, installments, setInstallments, isDisabled, baseTotal,
  extraOnlineOptions = [], children,
}) {
  const onlineOptions = [...onlinePaymentOptions, ...extraOnlineOptions];

  return (
    <>
      <div className="co-divider" />
      <div className="co-section-label">🚚 Pagamento na entrega</div>
      <PayOptionGrid
        options={deliveryPaymentOptions}
        payment={payment}
        setPayment={setPayment}
        setInstallments={setInstallments}
        isDisabled={isDisabled}
      />

      {payment === "credit_card" && (
        <div className="co-installments">
          {MAX_INSTALLMENTS > 1 ? (
            <>
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
            </>
          ) : (
            <p className="co-installments-label">
              Pagamento à vista no crédito (1x)
            </p>
          )}
          <p className="co-installments-hint">
            Pagamento na entrega, na maquininha — leve o cartão certo. O
            valor já inclui a taxa da maquininha. 💳
          </p>
        </div>
      )}

      <div className="co-pay-group-divider" />
      <div className="co-section-label">🌐 Pagamento online</div>
      <PayOptionGrid
        options={onlineOptions}
        payment={payment}
        setPayment={setPayment}
        setInstallments={setInstallments}
        isDisabled={isDisabled}
      />

      {payment === "mercadopago_card" && children}
    </>
  );
}
