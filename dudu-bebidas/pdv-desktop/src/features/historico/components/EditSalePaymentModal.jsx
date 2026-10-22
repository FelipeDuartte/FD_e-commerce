import { useMemo, useState } from "react";
import { formatBRL } from "../../../shared/utils/format";
import { SPLIT_PAYMENT_METHODS } from "../../../shared/constants";
import {
  applyCreditCardFee,
  MAX_INSTALLMENTS_PDV,
  roundCents,
} from "../../venda/utils/creditFee";

const INSTALLMENT_OPTIONS = Array.from(
  { length: MAX_INSTALLMENTS_PDV },
  (_, i) => i + 1,
);

// Troca a forma de pagamento de uma venda do caixa aberto. A taxa da
// maquininha é recalculada: virar crédito soma a taxa, sair do crédito tira.
export default function EditSalePaymentModal({
  sale,
  installmentFeeRate,
  onConfirm,
  onDismiss,
}) {
  // Valor da venda sem a taxa do cartão — é sobre ele que a nova taxa incide.
  const base = roundCents(sale.total - (sale.cardFeeAmount ?? 0));
  const startsSplit =
    sale.paymentMethod === "misto" && sale.payments?.length >= 2;

  const [split, setSplit] = useState(startsSplit);
  const [method, setMethod] = useState(
    startsSplit ? "cash" : sale.paymentMethod,
  );
  const [installments, setInstallments] = useState(sale.installments ?? 1);
  const [lines, setLines] = useState(
    startsSplit
      ? sale.payments.map((p) => ({
          method: p.method,
          amount: String(p.amount),
        }))
      : [
          { method: "cash", amount: "" },
          { method: "pix", amount: "" },
        ],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const newTotal = split
    ? base
    : method === "credit_card"
      ? applyCreditCardFee(base, installments, installmentFeeRate)
      : base;
  const remaining = useMemo(
    () =>
      roundCents(base - lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)),
    [base, lines],
  );

  const updateLine = (i, field, value) =>
    setLines((prev) =>
      prev.map((l, j) => (j === i ? { ...l, [field]: value } : l)),
    );

  const handleConfirm = async () => {
    if (split) {
      if (lines.length < 2 || lines.some((l) => !(Number(l.amount) > 0))) {
        setError(
          "Informe pelo menos 2 formas, cada uma com valor maior que zero.",
        );
        return;
      }
      if (Math.abs(remaining) >= 0.01) {
        setError(`A soma precisa ser ${formatBRL(base)}.`);
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      await onConfirm(
        split
          ? {
              payments: lines.map((l) => ({
                method: l.method,
                amount: Number(l.amount),
              })),
            }
          : {
              payments: [{ method }],
              installments: method === "credit_card" ? installments : null,
            },
      );
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="adm-modal-overlay"
        onClick={() => !saving && onDismiss()}
      />
      <div
        className="adm-modal pdv-credit-modal"
        role="dialog"
        aria-modal="true"
      >
        <h2 className="adm-store-section-title">
          Forma de pagamento — venda #{sale.orderNumber}
        </h2>
        <p className="adm-store-section-desc">
          Valor da venda: {formatBRL(base)}
        </p>

        {error && <div className="adm-modal-error">⚠️ {error}</div>}

        <div className="pdv-delivery-toggle-row">
          <button
            type="button"
            className={`pdv-delivery-toggle-btn ${!split ? "active" : ""}`}
            onClick={() => setSplit(false)}
          >
            Uma forma
          </button>
          <button
            type="button"
            className={`pdv-delivery-toggle-btn ${split ? "active" : ""}`}
            onClick={() => setSplit(true)}
          >
            🔀 Dividido
          </button>
        </div>

        {!split ? (
          <>
            <div className="adm-form-field">
              <label>Forma de pagamento</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                {SPLIT_PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.icon} {m.label}
                  </option>
                ))}
              </select>
            </div>
            {method === "credit_card" && (
              <div className="adm-form-field">
                <label>Parcelas</label>
                <select
                  value={installments}
                  onChange={(e) => setInstallments(Number(e.target.value))}
                >
                  {INSTALLMENT_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}x — total{" "}
                      {formatBRL(
                        applyCreditCardFee(base, n, installmentFeeRate),
                      )}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        ) : (
          <div className="pdv-split-payments">
            {lines.map((line, i) => (
              <div className="pdv-split-line" key={i}>
                <select
                  className="pdv-split-select"
                  value={line.method}
                  onChange={(e) => updateLine(i, "method", e.target.value)}
                >
                  {SPLIT_PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.icon} {m.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="pdv-split-amount"
                  placeholder="Valor (R$)"
                  value={line.amount}
                  onChange={(e) => updateLine(i, "amount", e.target.value)}
                />
                <button
                  className="adm-btn-delete"
                  title="Remover forma"
                  onClick={() =>
                    setLines((prev) => prev.filter((_, j) => j !== i))
                  }
                  disabled={lines.length <= 2}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="pdv-split-add-btn"
              onClick={() =>
                setLines((prev) => [...prev, { method: "cash", amount: "" }])
              }
            >
              + Adicionar forma
            </button>
            <div
              className={`pdv-split-remaining ${Math.abs(remaining) < 0.01 ? "pdv-split-ok" : ""}`}
            >
              {remaining > 0.004
                ? `Falta alocar: ${formatBRL(remaining)}`
                : remaining < -0.004
                  ? `Excedeu em: ${formatBRL(Math.abs(remaining))}`
                  : "✓ Valores batem com o total"}
            </div>
          </div>
        )}

        {Math.abs(newTotal - sale.total) >= 0.005 && (
          <div className="pdv-credit-preview pdv-credit-preview-deduct">
            O total da venda muda de {formatBRL(sale.total)} para{" "}
            {formatBRL(newTotal)}
            <span>
              {newTotal > sale.total
                ? "Soma a taxa da maquininha do crédito."
                : "Sai a taxa da maquininha do crédito."}
            </span>
          </div>
        )}

        <div className="adm-store-form-actions">
          <button
            className="adm-btn-new-product"
            onClick={handleConfirm}
            disabled={saving}
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <button
            className="adm-btn-back"
            onClick={onDismiss}
            disabled={saving}
          >
            Cancelar
          </button>
        </div>
      </div>
    </>
  );
}
