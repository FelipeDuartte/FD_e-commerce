import { PAYMENT_METHODS as PAYMENT_LABELS } from "../../../utils/paymentMethods";

export default function PaymentMethodCard({ payment, installments }) {
  const paymentInfo = PAYMENT_LABELS[payment] ?? { icon: "💳", label: payment };

  return (
    <div className="cf-card cf-card-payment">
      <div className="cf-card-label">💳 Forma de Pagamento</div>
      <div className="cf-payment">
        <span className="cf-payment-icon">{paymentInfo.icon}</span>
        <span className="cf-payment-label">
          {paymentInfo.label}
          {payment === "credit_card" && installments > 1 ? ` em ${installments}x` : ""}
        </span>
      </div>
    </div>
  );
}
