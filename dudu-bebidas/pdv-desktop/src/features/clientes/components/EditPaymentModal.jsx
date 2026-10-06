import { useState } from "react";
import { SPLIT_PAYMENT_METHODS } from "../../../shared/constants";

// Corrige valor ou forma de um pagamento já registrado. Se o valor cair e
// algum pedido deixar de estar quitado, o estoque dele volta (ver
// settle_fiado_stock no banco).
export default function EditPaymentModal({ payment, onConfirm, onDismiss }) {
  const [amount, setAmount] = useState(String(payment.amount));
  const [paymentMethod, setPaymentMethod] = useState(payment.method);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async (e) => {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Informe um valor válido.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onConfirm({ amount: value, paymentMethod });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <>
      <div className="adm-modal-overlay" onClick={() => !saving && onDismiss()} />
      <div className="adm-modal" role="dialog" aria-modal="true">
        <h2 className="adm-store-section-title">Editar pagamento</h2>
        <form onSubmit={handleConfirm}>
          <div className="adm-form-field">
            <label>Valor (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="adm-form-field">
            <label>Forma de pagamento</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {SPLIT_PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.icon} {m.label}</option>
              ))}
            </select>
          </div>

          {error && <div className="adm-modal-error">⚠️ {error}</div>}

          <div className="adm-store-form-actions">
            <button className="adm-btn-new-product" type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button className="adm-btn-back" type="button" onClick={onDismiss} disabled={saving}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
