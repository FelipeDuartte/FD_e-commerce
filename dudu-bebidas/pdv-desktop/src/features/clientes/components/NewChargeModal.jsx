import { useState } from "react";

// Lançamento livre de dívida — valor + descrição, sem carrinho/estoque.
// Pro caso de "cliente pagou uma parte agora, o resto fica em aberto": a
// venda dos produtos vai pela aba Venda normalmente (com baixa de
// estoque) pela forma de pagamento usada de fato; a diferença que ficou
// pendente é lançada aqui.
export default function NewChargeModal({ customer, onConfirm, onDismiss }) {
  const [amountInput, setAmountInput] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Informe um valor válido.");
      return;
    }
    if (!description.trim()) {
      setError("Descreva o que foi vendido.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onConfirm({ amount, description: description.trim() });
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <>
      <div className="adm-modal-overlay" onClick={() => !saving && onDismiss()} />
      <div className="adm-modal" role="dialog" aria-modal="true">
        <h2 className="adm-store-section-title">Novo pedido em aberto — {customer.name}</h2>
        <p className="pdv-bill-hint">
          Lança um valor na conta do cliente sem passar pelo carrinho — não baixa estoque.
        </p>

        {error && <div className="adm-modal-error">⚠️ {error}</div>}

        <div className="adm-form-field">
          <label>Valor (R$)</label>
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
          <label>Referente a</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: 2 cervejas + 1 refri"
          />
        </div>

        <div className="adm-store-form-actions">
          <button className="adm-btn-new-product" onClick={handleConfirm} disabled={saving}>
            {saving ? "Salvando..." : "Lançar"}
          </button>
          <button className="adm-btn-back" onClick={onDismiss} disabled={saving}>
            Cancelar
          </button>
        </div>
      </div>
    </>
  );
}
