import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Plus, Minus, Trash2, ShoppingBag, Tag } from "lucide-react";
import "./Cart.css";

export default function Cart({
  isOpen,
  onClose,
  cartItems,
  updateQuantity,
  removeItem,
  clearCart,
}) {
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  //navegaçao
  const navigate = useNavigate();

  // Calcular totais
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.preco * item.quantity,
    0,
  );
  const desconto = appliedCoupon ? subtotal * 0.1 : 0;
  const frete = subtotal >= 50 ? 0 : 8.99;
  const total = subtotal - desconto + frete;

  const handleApplyCoupon = () => {
    if (couponCode.toUpperCase() === "DUDU10") {
      setAppliedCoupon({ code: "DUDU10", discount: 10 });
      setCouponCode("");
    }
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) return;
    onClose();
    navigate("/checkout");
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`cart-overlay ${isOpen ? "show" : ""}`}
        onClick={onClose}
      />

      {/* Cart Drawer */}
      <div className={`cart-drawer ${isOpen ? "open" : ""}`}>
        {/* Header */}
        <div className="cart-header">
          <div className="cart-header-content">
            <div className="cart-icon-wrapper">
              <ShoppingBag size={24} color="#000" />
            </div>
            <div className="cart-title-wrapper">
              <h3>Meu Carrinho</h3>
              <span className="cart-item-count">
                {cartItems.length} {cartItems.length === 1 ? "item" : "itens"}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="cart-close-btn">
            <X size={24} color="#000" />
          </button>
        </div>

        {/* Cart Body */}
        <div className="cart-body">
          {cartItems.length === 0 ? (
            <div className="cart-empty">
              <ShoppingBag
                size={64}
                color="#d1d5db"
                strokeWidth={1.5}
                className="cart-empty-icon"
              />
              <h4>Carrinho vazio</h4>
              <p>Adicione produtos para começar suas compras</p>
            </div>
          ) : (
            <div className="cart-items-wrapper">
              {cartItems.map((item) => (
                <div key={item.id} className="cart-item">
                  {/* Imagem */}
                  <img
                    src={item.imagem}
                    alt={item.nome}
                    className="cart-item-image"
                  />

                  {/* Info */}
                  <div className="cart-item-details">
                    <h4 className="cart-item-name">{item.nome}</h4>

                    <div className="cart-item-price-row">
                      <span className="cart-item-price">
                        R$ {item.preco.toFixed(2)}
                      </span>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="cart-item-remove"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    {/* Quantity Controls */}
                    <div className="quantity-controls">
                      <button
                        onClick={() =>
                          updateQuantity(
                            item.id,
                            Math.max(1, item.quantity - 1),
                          )
                        }
                        className="quantity-btn"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="quantity-value">{item.quantity}</span>
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity + 1)
                        }
                        className="quantity-btn"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Clear Cart Button */}
              {cartItems.length > 0 && (
                <button onClick={clearCart} className="clear-cart-btn">
                  <Trash2 size={16} />
                  Limpar Carrinho
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {cartItems.length > 0 && (
          <div className="cart-footer">
            {/* Cupom */}
            <div className="coupon-section">
              <div className="coupon-input-wrapper">
                <div className="coupon-input-container">
                  <Tag size={18} className="coupon-icon" />
                  <input
                    type="text"
                    placeholder="Código do cupom"
                    value={couponCode}
                    onChange={(e) =>
                      setCouponCode(e.target.value.toUpperCase())
                    }
                    className="coupon-input"
                  />
                </div>
                <button
                  onClick={handleApplyCoupon}
                  className="coupon-apply-btn"
                >
                  Aplicar
                </button>
              </div>
              {appliedCoupon && (
                <div className="coupon-applied">
                  ✓ Cupom {appliedCoupon.code} aplicado (
                  {appliedCoupon.discount}% OFF)
                </div>
              )}
              <div className="coupon-hint">
                Dica: Use DUDU10 para 10% de desconto
              </div>
            </div>

            {/* Resumo */}
            <div className="summary-section">
              <div className="summary-row">
                <span>Subtotal:</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              {appliedCoupon && (
                <div className="summary-row discount">
                  <span>Desconto:</span>
                  <span>- R$ {desconto.toFixed(2)}</span>
                </div>
              )}
              <div
                className={`summary-row ${frete === 0 ? "free-shipping" : ""}`}
              >
                <span>Frete:</span>
                <span>{frete === 0 ? "GRÁTIS" : `R$ ${frete.toFixed(2)}`}</span>
              </div>
              {subtotal < 50 && (
                <div className="shipping-progress">
                  💡 Falta R$ {(50 - subtotal).toFixed(2)} para frete grátis
                </div>
              )}
              <div className="summary-total">
                <span className="total-label">Total:</span>
                <span className="total-value">R$ {total.toFixed(2)}</span>
              </div>
            </div>

            {/* Checkout Button */}
            <button onClick={handleCheckout} className="checkout-btn">
              Finalizar Pedido
            </button>
          </div>
        )}
      </div>
    </>
  );
}
