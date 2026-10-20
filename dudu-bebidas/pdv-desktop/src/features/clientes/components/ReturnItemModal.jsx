import { useState } from "react";
import { formatBRL } from "../../../shared/utils/format";

// Devolver parte de um item de pedido em aberto. Quem decide de verdade é o
// banco (return_fiado_item); a prévia aqui usa a mesma regra pra o operador
// saber o que vai acontecer antes de confirmar.
export default function ReturnItemModal({ customer, item, onConfirm, onDismiss }) {
  const max = item.quantity - item.returnedQuantity;
  const [qtyInput, setQtyInput] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const qty = Number(qtyInput);
  const validQty = Number.isInteger(qty) && qty >= 1 && qty <= max;
  const value = validQty ? item.price * qty : 0;
  const willDeduct = customer.balance >= value - 0.004;

  const handleConfirm = async () => {
    if (!validQty) {
      setError(`Informe uma quantidade entre 1 e ${max}.`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onConfirm(qty);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <>
      <div className="adm-modal-overlay" onClick={() => !saving && onDismiss()} />
      <div className="adm-modal pdv-credit-modal" role="dialog" aria-modal="true">
        <h2 className="adm-store-section-title">Devolver produto</h2>
        <p className="adm-store-section-desc">
          <strong>{item.name}</strong> — pode devolver até {max} un.
        </p>

        {error && <div className="adm-modal-error">⚠️ {error}</div>}

        <div className="adm-form-field">
          <label>Quantidade devolvida</label>
          <input
            type="number"
            min="1"
            max={max}
            step="1"
            value={qtyInput}
            onChange={(e) => setQtyInput(e.target.value)}
            autoFocus
          />
        </div>

        {validQty && (
          <div className={`pdv-credit-preview ${willDeduct ? "pdv-credit-preview-deduct" : "pdv-credit-preview-credit"}`}>
            {willDeduct
              ? `Ainda está em aberto: abate ${formatBRL(value)} da dívida do cliente.`
              : `Já foi pago: o cliente fica com crédito de ${qty} un. de ${item.name} pra retirar depois.`}
            <span>O produto volta pro estoque.</span>
          </div>
        )}

        <div className="adm-store-form-actions">
          <button className="adm-btn-new-product" onClick={handleConfirm} disabled={saving}>
            {saving ? "Registrando..." : "Confirmar devolução"}
          </button>
          <button className="adm-btn-back" onClick={onDismiss} disabled={saving}>
            Cancelar
          </button>
        </div>
      </div>
    </>
  );
}
