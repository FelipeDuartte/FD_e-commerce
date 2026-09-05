import { useState } from "react";
import { formatBRL } from "../../../shared/utils/format";
import { remainingAmount } from "../billStatus";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function MarkPaidModal({ bill, saving, error, onConfirm, onDismiss }) {
  const alreadyPaid = Number(bill.amount_paid ?? 0);
  const remaining = remainingAmount(bill);

  const [paidAt, setPaidAt] = useState(today());
  const [amountPaidInput, setAmountPaidInput] = useState(remaining.toFixed(2));

  const handleConfirm = () => {
    onConfirm({ paidAt, amountPaid: Number(amountPaidInput) });
  };

  return (
    <>
      <div className="adm-modal-overlay" onClick={() => !saving && onDismiss()} />
      <div className="adm-modal" role="dialog" aria-modal="true">
        <h2 className="adm-store-section-title">Dar baixa — {bill.description}</h2>
        <p className="pdv-bill-hint">
          Valor da conta: {formatBRL(bill.amount)}
          {alreadyPaid > 0 && ` · já pago: ${formatBRL(alreadyPaid)} · falta: ${formatBRL(remaining)}`}
        </p>
        <p className="pdv-bill-hint">
          Se pagar menos que o valor restante, a conta fica como "Pago Parcial" — dá pra dar baixa de novo depois.
        </p>

        {error && <div className="adm-modal-error">⚠️ {error}</div>}

        <div className="adm-form-row" style={{ flexWrap: "wrap" }}>
          <div className="adm-form-field">
            <label>Pago em</label>
            <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} autoFocus />
          </div>
          <div className="adm-form-field">
            <label>Valor pago (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountPaidInput}
              onChange={(e) => setAmountPaidInput(e.target.value)}
            />
          </div>
        </div>

        <div className="adm-store-form-actions">
          <button className="adm-btn-new-product" onClick={handleConfirm} disabled={saving}>
            {saving ? "Registrando..." : "Confirmar baixa"}
          </button>
          <button className="adm-btn-back" onClick={onDismiss} disabled={saving}>
            Cancelar
          </button>
        </div>
      </div>
    </>
  );
}
