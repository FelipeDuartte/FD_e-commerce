import { formatBRL } from "../../../shared/utils/format";
import { PAYMENT_METHODS } from "../../../shared/constants";

function methodLabel(method) {
  const known = PAYMENT_METHODS.find((m) => m.value === method);
  return known ? `${known.icon} ${known.label}` : method;
}

export default function CloseSessionModal({
  closing, closeError, closeResult, declaredAmountInput, setDeclaredAmountInput,
  onConfirm, onDismiss,
}) {
  return (
    <>
      <div className="adm-modal-overlay" onClick={() => !closing && onDismiss()} />
      <div className="adm-modal" role="dialog" aria-modal="true">
        {closeResult ? (
          <>
            <h2 className="adm-store-section-title">Caixa fechado</h2>

            {closeResult.breakdown?.length > 0 && (
              <div className="pdv-close-breakdown">
                {closeResult.breakdown.map((b) => (
                  <div key={b.method} className="pdv-close-breakdown-row">
                    <span>{methodLabel(b.method)}</span>
                    <strong>{formatBRL(b.amount)}</strong>
                  </div>
                ))}
                {closeResult.fiado_total > 0 && (
                  <div className="pdv-close-breakdown-row pdv-close-breakdown-fiado">
                    <span>📝 Vendido em aberto (não recebido)</span>
                    <strong>{formatBRL(closeResult.fiado_total)}</strong>
                  </div>
                )}
              </div>
            )}

            <div className="pdv-close-summary">
              <div><span>Esperado (dinheiro)</span><strong>{formatBRL(closeResult.expected)}</strong></div>
              <div><span>Contado</span><strong>{formatBRL(closeResult.declared)}</strong></div>
              <div className={closeResult.difference !== 0 ? "pdv-close-diff-mismatch" : ""}>
                <span>Diferença</span><strong>{formatBRL(closeResult.difference)}</strong>
              </div>
            </div>
            <button className="adm-btn-new-product" onClick={onDismiss}>Fechar</button>
          </>
        ) : (
          <>
            <h2 className="adm-store-section-title">Fechar caixa</h2>
            <p className="adm-store-section-desc">
              Conte o dinheiro em caixa e informe o valor total encontrado.
            </p>
            {closeError && <div className="adm-modal-error">⚠️ {closeError}</div>}
            <div className="adm-form-field">
              <label>Valor contado (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={declaredAmountInput}
                onChange={(e) => setDeclaredAmountInput(e.target.value)}
                placeholder="0,00"
                autoFocus
              />
            </div>
            <div className="adm-store-form-actions">
              <button className="adm-btn-new-product" onClick={onConfirm} disabled={closing}>
                {closing ? "Fechando..." : "Confirmar fechamento"}
              </button>
              <button className="adm-btn-back" onClick={onDismiss} disabled={closing}>
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
