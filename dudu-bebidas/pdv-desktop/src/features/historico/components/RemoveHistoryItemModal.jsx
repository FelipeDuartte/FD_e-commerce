import { useState } from "react";
import { formatBRL } from "../../../shared/utils/format";

export default function RemoveHistoryItemModal({ sale, item, onConfirm, onDismiss }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isLastItem = sale.orderItems.length === 1;

  const handleConfirm = async () => {
    setSaving(true);
    setError("");
    try {
      await onConfirm();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <>
      <div className="adm-modal-overlay" onClick={() => !saving && onDismiss()} />
      <div className="adm-modal pdv-credit-modal" role="dialog" aria-modal="true">
        <h2 className="adm-store-section-title">Excluir item da venda #{sale.orderNumber}</h2>
        <p className="adm-store-section-desc">
          <strong>{item.quantity > 1 ? `${item.name} x${item.quantity}` : item.name}</strong> —{" "}
          {formatBRL(item.price * item.quantity)}
        </p>

        {error && <div className="adm-modal-error">⚠️ {error}</div>}

        <div className={`pdv-credit-preview ${isLastItem ? "pdv-credit-preview-deduct" : "pdv-credit-preview-credit"}`}>
          {isLastItem
            ? "É o único item da venda — a venda inteira será cancelada."
            : "O total da venda é recalculado (desconto e taxa do cartão na mesma proporção)."}
          <span>O produto volta pro estoque.</span>
        </div>

        <div className="adm-store-form-actions">
          <button className="adm-btn-new-product" onClick={handleConfirm} disabled={saving}>
            {saving ? "Excluindo..." : isLastItem ? "Excluir e cancelar venda" : "Excluir item"}
          </button>
          <button className="adm-btn-back" onClick={onDismiss} disabled={saving}>
            Voltar
          </button>
        </div>
      </div>
    </>
  );
}
