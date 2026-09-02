import { useState } from "react";
import { formatBRL } from "../../../shared/utils/format";
import { SPLIT_PAYMENT_METHODS } from "../../../shared/constants";

// Não oferece "fiado" como forma aqui de propósito — não faz sentido
// quitar uma dívida com outra dívida (SPLIT_PAYMENT_METHODS já exclui).
export default function PayDebtModal({ customer, onConfirm, onDismiss }) {
  const [amountInput, setAmountInput] = useState(
    customer.balance > 0 ? customer.balance.toFixed(2) : "",
  );
  const [method, setMethod] = useState("cash");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Informe um valor válido.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onConfirm({ amount, paymentMethod: method });
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <>
      <div className="adm-modal-overlay" onClick={() => !saving && onDismiss()} />
      <div className="adm-modal" role="dialog" aria-modal="true">
        <h2 className="adm-store-section-title">Receber pagamento — {customer.name}</h2>
        <p className="adm-store-section-desc">Saldo devedor atual: {formatBRL(customer.balance)}</p>

        {error && <div className="adm-modal-error">⚠️ {error}</div>}

        <div className="adm-form-field">
          <label>Valor recebido (R$)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            autoFocus
          />
        </div>

        <div className="adm-form-field">
          <label>Forma de pagamento</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            {SPLIT_PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.icon} {m.label}</option>
            ))}
          </select>
        </div>

        <div className="adm-store-form-actions">
          <button className="adm-btn-new-product" onClick={handleConfirm} disabled={saving}>
            {saving ? "Registrando..." : "Confirmar recebimento"}
          </button>
          <button className="adm-btn-back" onClick={onDismiss} disabled={saving}>
            Cancelar
          </button>
        </div>
      </div>
    </>
  );
}
