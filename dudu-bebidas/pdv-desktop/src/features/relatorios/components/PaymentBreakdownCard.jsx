import { formatBRL } from "../../../shared/utils/format";
import { PAYMENT_METHODS } from "../../../shared/utils/paymentMethods";

// PAYMENT_METHODS local do PDV só tem os 5 métodos que o balcão usa — no
// recorte "Geral" pode aparecer método só do site (pix_entrega,
// mercadopago_card, "card" legado). Fallback genérico pra esses casos,
// mesmo padrão já usado em OrderCard.jsx no admin web.
function methodInfo(method) {
  return PAYMENT_METHODS[method] ?? { icon: "💳", label: method };
}

export default function PaymentBreakdownCard({ breakdown }) {
  if (!breakdown?.length) {
    return <p className="rpt-no-data">Sem dados no período.</p>;
  }

  return (
    <div className="rpt-payment-list">
      {breakdown.map(({ method, amount, pct }) => {
        const info = methodInfo(method);
        return (
          <div className="rpt-payment-row" key={method}>
            <div className="rpt-payment-row-top">
              <span className="rpt-payment-label">
                {info.icon} {info.label}
              </span>
              <span className="rpt-payment-amount">{formatBRL(amount)}</span>
            </div>
            <div className="rpt-payment-bar-track">
              <div className="rpt-payment-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="rpt-payment-pct">{pct.toFixed(1)}%</span>
          </div>
        );
      })}
    </div>
  );
}
