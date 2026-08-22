import { formatBRL } from "../../adminUtils";
import { PAYMENT_METHODS } from "../constants";

export default function CartPanel({
  cart, updateQuantity, removeFromCart,
  paymentMethod, setPaymentMethod, discountMode, setDiscountMode, discountInput, setDiscountInput,
  subtotal, discountAmount, cartTotal, submitting, onFinalize,
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
                <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>−</button>
                <span>{item.quantity}</span>
                <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
              </div>
              <button className="adm-btn-delete" onClick={() => removeFromCart(item.id)}>🗑️</button>
            </div>
          ))}
        </div>
      )}

      <div className="pdv-payment-methods">
        {PAYMENT_METHODS.map((m) => (
          <button
            key={m.value}
            className={`pdv-payment-btn ${paymentMethod === m.value ? "active" : ""}`}
            onClick={() => setPaymentMethod(m.value)}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      <div className="pdv-discount-row">
        <div className="pdv-discount-mode">
          <button
            className={`pdv-discount-mode-btn ${discountMode === "amount" ? "active" : ""}`}
            onClick={() => setDiscountMode("amount")}
          >
            R$
          </button>
          <button
            className={`pdv-discount-mode-btn ${discountMode === "percent" ? "active" : ""}`}
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
        <div className="pdv-cart-total">
          <span>Total</span>
          <strong>{formatBRL(cartTotal)}</strong>
        </div>
      </div>

      <button
        className="adm-btn-new-product pdv-finalize-btn"
        onClick={onFinalize}
        disabled={cart.length === 0 || submitting}
      >
        {submitting ? "Registrando..." : "✅ Finalizar venda"}
      </button>
    </div>
  );
}
