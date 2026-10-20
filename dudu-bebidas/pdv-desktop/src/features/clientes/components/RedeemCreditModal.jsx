import { useState } from "react";

export default function RedeemCreditModal({ credit, onConfirm, onDismiss }) {
  const [qtyInput, setQtyInput] = useState(String(credit.quantity));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    const qty = Number(qtyInput);
    if (!Number.isInteger(qty) || qty < 1 || qty > credit.quantity) {
      setError(`Informe uma quantidade entre 1 e ${credit.quantity}.`);
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
        <h2 className="adm-store-section-title">Retirar crédito</h2>
        <p className="adm-store-section-desc">
          <strong>{credit.productName}</strong> — {credit.quantity} un. em crédito
        </p>

        {error && <div className="adm-modal-error">⚠️ {error}</div>}

        <div className="adm-form-field">
          <label>Quantidade que o cliente vai levar</label>
          <input
            type="number"
            min="1"
            max={credit.quantity}
            step="1"
            value={qtyInput}
            onChange={(e) => setQtyInput(e.target.value)}
            autoFocus
          />
        </div>

        <div className="pdv-credit-preview pdv-credit-preview-credit">
          Sai do estoque sem cobrar nada — não entra no caixa nem conta como venda.
        </div>

        <div className="adm-store-form-actions">
          <button className="adm-btn-new-product" onClick={handleConfirm} disabled={saving}>
            {saving ? "Registrando..." : "Confirmar retirada"}
          </button>
          <button className="adm-btn-back" onClick={onDismiss} disabled={saving}>
            Cancelar
          </button>
        </div>
      </div>
    </>
  );
}
