import { formatBRL } from "../../../shared/utils/format";
import { PAYMENT_METHODS, SPLIT_PAYMENT_METHODS } from "../../../shared/constants";
import { DEFAULT_INSTALLMENT_FEE_RATE, MAX_INSTALLMENTS_PDV, applyCreditCardFee } from "../utils/creditFee";
import FiadoCustomerPicker from "./FiadoCustomerPicker";

const INSTALLMENT_OPTIONS = Array.from({ length: MAX_INSTALLMENTS_PDV }, (_, i) => i + 1);

// Sistema antigo do cliente navegava a forma de pagamento com as
// setinhas do teclado — reproduz isso aqui: ↑↓←→ move o foco entre os
// botões (2 colunas, mesmo layout do CSS), Enter/Espaço já seleciona
// sozinho (comportamento nativo de <button>, não precisa de código extra).
const PAYMENT_GRID_COLUMNS = 2;

function handlePaymentGridKeyDown(e, index, total) {
  const deltas = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: PAYMENT_GRID_COLUMNS, ArrowUp: -PAYMENT_GRID_COLUMNS };
  const delta = deltas[e.key];
  if (delta === undefined) return;
  e.preventDefault();
  const next = (index + delta + total) % total;
  const buttons = e.currentTarget.parentElement.querySelectorAll(".pdv-payment-btn");
  buttons[next]?.focus();
}

export default function CartPanel({
  cart, updateQuantity, removeFromCart,
  paymentMethod, setPaymentMethod, installments, setInstallments, discountMode, setDiscountMode, discountInput, setDiscountInput,
  subtotal, discountAmount, cartTotal, saleTotal, submitting, onFinalize,
  installmentFeeRate = DEFAULT_INSTALLMENT_FEE_RATE,
  receivedAmountInput, setReceivedAmountInput, changeAmount, insufficientCash,
  splitMode, toggleSplitMode, splitPayments, updateSplitLine, addSplitLine,
  removeSplitLine, splitRemaining, splitValid,
  fiadoCustomer, setFiadoCustomer, missingFiadoCustomer, fiadoCustomers, fiadoCustomersLoading, createFiadoCustomer,
}) {
  return (
    <div className="pdv-cart">
      <h2 className="adm-store-section-title">Carrinho</h2>
      {cart.length === 0 ? (
        <div className="adm-empty"><p>Nenhum item ainda.</p></div>
      ) : (
        <div className="pdv-cart-items">
          {cart.map((item) => (
            <div key={item.id} className="pdv-cart-item">
              <div className="pdv-cart-item-info">
                <span className="pdv-cart-item-name">{item.name}</span>
                <span className="pdv-cart-item-price">{formatBRL(item.price)} un.</span>
              </div>
              <div className="pdv-cart-item-qty">
                <button title="Diminuir quantidade" onClick={() => updateQuantity(item.id, item.quantity - 1)}>−</button>
                <input
                  type="number"
                  className="pdv-cart-item-qty-input"
                  min="1"
                  max={item.stock}
                  value={item.quantity}
                  onChange={(e) => updateQuantity(item.id, Number(e.target.value))}
                  title="Digite a quantidade"
                />
                <button title="Aumentar quantidade" onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
              </div>
              <button className="adm-btn-delete" title="Remover item" onClick={() => removeFromCart(item.id)}>🗑️</button>
            </div>
          ))}
        </div>
      )}

      <button type="button" className="pdv-split-toggle" onClick={toggleSplitMode}>
        {splitMode ? "← Pagamento único" : "🔀 Dividir pagamento"}
      </button>

      {!splitMode ? (
        <>
          <div className="pdv-payment-methods">
            {PAYMENT_METHODS.map((m, i) => (
              <button
                key={m.value}
                className={`pdv-payment-btn ${paymentMethod === m.value ? "active" : ""}`}
                onClick={() => setPaymentMethod(m.value)}
                onKeyDown={(e) => handlePaymentGridKeyDown(e, i, PAYMENT_METHODS.length)}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>

          {paymentMethod === "cash" && (
            <div className="pdv-change-row">
              <input
                type="number"
                min="0"
                step="0.01"
                className="pdv-change-input"
                placeholder="Valor recebido (R$)"
                value={receivedAmountInput}
                onChange={(e) => setReceivedAmountInput(e.target.value)}
              />
              {changeAmount !== null && (
                <span className={`pdv-change-result ${changeAmount < 0 ? "pdv-change-insufficient" : ""}`}>
                  {changeAmount < 0 ? "Falta" : "Troco"}: {formatBRL(Math.abs(changeAmount))}
                </span>
              )}
            </div>
          )}

          {paymentMethod === "credit_card" && (
            <div className="pdv-installments">
              <label htmlFor="pdv-installments-select" className="pdv-installments-label">
                Em quantas vezes?
              </label>
              <select
                id="pdv-installments-select"
                className="pdv-installments-select"
                value={installments}
                onChange={(e) => setInstallments(Number(e.target.value))}
              >
                {INSTALLMENT_OPTIONS.map((n) => {
                  const optTotal = applyCreditCardFee(cartTotal, n, installmentFeeRate);
                  const perInstallment = optTotal / n;
                  const ratePct = ((installmentFeeRate[n] ?? 0) * 100).toFixed(2).replace(".", ",");
                  return (
                    <option key={n} value={n}>
                      {n}x {n === 1 ? "à vista" : `de ${formatBRL(perInstallment)}`}
                      {" "}— total {formatBRL(optTotal)} (taxa {ratePct}%)
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {paymentMethod === "fiado" && (
            <FiadoCustomerPicker
              customers={fiadoCustomers}
              customersLoading={fiadoCustomersLoading}
              selectedCustomer={fiadoCustomer}
              onSelectCustomer={setFiadoCustomer}
              onCreateCustomer={createFiadoCustomer}
            />
          )}
        </>
      ) : (
        <div className="pdv-split-payments">
          {splitPayments.map((line, i) => (
            <div className="pdv-split-line" key={i}>
              <select
                className="pdv-split-select"
                value={line.method}
                onChange={(e) => updateSplitLine(i, "method", e.target.value)}
              >
                {SPLIT_PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.icon} {m.label}</option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                className="pdv-split-amount"
                placeholder="Valor (R$)"
                value={line.amount}
                onChange={(e) => updateSplitLine(i, "amount", e.target.value)}
              />
              <button
                className="adm-btn-delete"
                title="Remover forma de pagamento"
                onClick={() => removeSplitLine(i)}
                disabled={splitPayments.length <= 1}
              >
                ✕
              </button>
            </div>
          ))}

          <button type="button" className="pdv-split-add-btn" onClick={addSplitLine}>
            + Adicionar forma
          </button>

          <div className={`pdv-split-remaining ${Math.abs(splitRemaining) < 0.01 ? "pdv-split-ok" : ""}`}>
            {splitRemaining > 0.004
              ? `Falta alocar: ${formatBRL(splitRemaining)}`
              : splitRemaining < -0.004
                ? `Excedeu em: ${formatBRL(Math.abs(splitRemaining))}`
                : "✓ Valores batem com o total"}
          </div>
        </div>
      )}

      <div className="pdv-discount-row">
        <div className="pdv-discount-mode">
          <button
            className={`pdv-discount-mode-btn ${discountMode === "amount" ? "active" : ""}`}
            title="Desconto em reais"
            onClick={() => setDiscountMode("amount")}
          >
            R$
          </button>
          <button
            className={`pdv-discount-mode-btn ${discountMode === "percent" ? "active" : ""}`}
            title="Desconto em porcentagem"
            onClick={() => setDiscountMode("percent")}
          >
            %
          </button>
        </div>
        <input
          type="number"
          min="0"
          step="0.01"
          className="pdv-discount-input"
          placeholder="Desconto"
          value={discountInput}
          onChange={(e) => setDiscountInput(e.target.value)}
        />
      </div>

      <div className="pdv-cart-summary">
        <div className="pdv-cart-subtotal-row">
          <span>Subtotal</span>
          <span>{formatBRL(subtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="pdv-cart-subtotal-row pdv-cart-discount-row">
            <span>Desconto</span>
            <span>−{formatBRL(discountAmount)}</span>
          </div>
        )}
        {paymentMethod === "credit_card" && saleTotal > cartTotal && (
          <div className="pdv-cart-subtotal-row">
            <span>Taxa da maquininha</span>
            <span>+{formatBRL(saleTotal - cartTotal)}</span>
          </div>
        )}
        <div className="pdv-cart-total">
          <span>Total</span>
          <strong>{formatBRL(saleTotal)}</strong>
        </div>
      </div>

      <button
        className="adm-btn-new-product pdv-finalize-btn"
        onClick={onFinalize}
        disabled={cart.length === 0 || submitting || (splitMode ? !splitValid : insufficientCash || missingFiadoCustomer)}
      >
        {submitting ? "Registrando..." : "✅ Finalizar venda"}
      </button>
    </div>
  );
}
