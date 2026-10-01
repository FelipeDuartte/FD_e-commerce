import { useState } from "react";
import { formatBRL } from "../../../shared/utils/format";

// Pede quantidade + valor TOTAL pago (não custo por unidade direto) —
// é assim que a nota fiscal chega na mão do dono, o sistema calcula o
// custo unitário sozinho. Depois de salvar, mostra a comparação com o
// custo anterior antes de fechar, pra ele perceber na hora se o
// fornecedor aumentou o preço.
//
// Bonificação (checkbox "🎁") é um caminho diferente dentro do MESMO
// modal — quantidade grátis que o fornecedor dá, sem valor pago e sem
// mexer no custo do produto (ver migration 0037). Em vez de custo, mostra
// quanto essa quantidade grátis vale no preço de venda atual (lucro
// estimado daquele lote).
export default function RegisterPurchaseModal({ product, onConfirmPurchase, onConfirmBonus, onDismiss }) {
  const [isBonus, setIsBonus] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [totalPaid, setTotalPaid] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const qtyNum = Number(quantity);
  const totalNum = Number(totalPaid);
  const unitCostPreview = qtyNum > 0 && totalNum > 0 ? totalNum / qtyNum : null;
  const bonusValuePreview = qtyNum > 0 && product.price > 0 ? qtyNum * product.price : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!qtyNum || qtyNum <= 0) {
      setError("Informe uma quantidade válida.");
      return;
    }
    if (!isBonus && (!totalNum || totalNum <= 0)) {
      setError("Informe o valor total pago.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const outcome = isBonus ? await onConfirmBonus(qtyNum) : await onConfirmPurchase(qtyNum, totalNum);
      setResult(outcome);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  const variation =
    !isBonus && result?.previousCost > 0
      ? ((result.newCost - result.previousCost) / result.previousCost) * 100
      : null;

  return (
    <>
      <div className="adm-modal-overlay" onClick={() => !saving && onDismiss()} />
      <div className="adm-modal pdv-purchase-modal" role="dialog" aria-modal="true">
        <h2 className="adm-store-section-title">{isBonus ? "🎁 Registrar bonificação" : "📦 Registrar compra"}</h2>
        <p className="adm-store-section-desc">
          <strong>{product.name}</strong>
        </p>

        {result ? (
          <>
            {isBonus ? (
              <div className="pdv-purchase-result">
                <div>
                  <span>Quantidade grátis</span>
                  <strong>{qtyNum}</strong>
                </div>
                <div className="pdv-purchase-down">
                  <span>Lucro estimado dessa bonificação</span>
                  <strong>{formatBRL(result.bonusValue)}</strong>
                </div>
              </div>
            ) : (
              <div className="pdv-purchase-result">
                <div>
                  <span>Custo anterior</span>
                  <strong>{result.previousCost ? formatBRL(result.previousCost) : "— (primeira compra)"}</strong>
                </div>
                <div>
                  <span>Novo custo (por unidade)</span>
                  <strong>{formatBRL(result.newCost)}</strong>
                </div>
                {variation !== null && (
                  <div className={variation > 0 ? "pdv-purchase-up" : variation < 0 ? "pdv-purchase-down" : ""}>
                    <span>Variação</span>
                    <strong>
                      {variation > 0 ? "▲ subiu" : variation < 0 ? "▼ desceu" : "sem mudança"}{" "}
                      {Math.abs(variation).toFixed(1)}%
                    </strong>
                  </div>
                )}
              </div>
            )}
            <div className="adm-store-form-actions">
              <button className="adm-btn-new-product" onClick={onDismiss}>
                Fechar
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="pdv-bonus-toggle">
              <input type="checkbox" checked={isBonus} onChange={(e) => setIsBonus(e.target.checked)} />
              <span>🎁 Bonificação do fornecedor (grátis)</span>
            </label>

            {isBonus ? (
              <div className="adm-form-field">
                <label>Quantidade recebida</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            ) : (
              <div className="adm-form-row">
                <div className="adm-form-field">
                  <label>Quantidade comprada</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <div className="adm-form-field">
                  <label>Valor total pago (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={totalPaid}
                    onChange={(e) => setTotalPaid(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {!isBonus && unitCostPreview !== null && (
              <p className="pdv-bill-hint">Custo por unidade: {formatBRL(unitCostPreview)}</p>
            )}
            {isBonus && (
              <p className="pdv-bill-hint">
                Preço de venda atual: {formatBRL(product.price)}
                {bonusValuePreview !== null && ` — lucro estimado: ${formatBRL(bonusValuePreview)}`}
              </p>
            )}

            {error && <div className="adm-modal-error">⚠️ {error}</div>}

            <div className="adm-store-form-actions">
              <button className="adm-btn-new-product" type="submit" disabled={saving}>
                {saving ? "Registrando..." : isBonus ? "Registrar bonificação" : "Registrar compra"}
              </button>
              <button className="adm-btn-back" type="button" onClick={onDismiss} disabled={saving}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
