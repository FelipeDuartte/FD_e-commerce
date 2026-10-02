import { useState } from "react";
import { useProductCatalog } from "../../venda/hooks/useProductCatalog";
import { useCart } from "../../venda/hooks/useCart";
import ProductCatalog from "../../venda/components/ProductCatalog";
import { formatBRL } from "../../../shared/utils/format";

// Pedido fiado com produtos de verdade (catálogo + carrinho, igual a aba
// Venda) — pro dono que vende vários itens diferentes fiado sem digitar
// "2 cervejas + 1 refri" na mão. Estoque não baixa na criação, só quando o
// pagamento cobrir esse pedido (deferStockUntilPaid, ver salesService.js).

export default function NewFiadoOrderModal({ customer, onConfirm, onDismiss }) {
  // Pedido pode ser pra entregar/retirar depois (dia que o fornecedor já
  // vai ter reabastecido) — por isso libera vender mesmo sem estoque hoje,
  // diferente da Venda normal (ver comentários em useCart/useProductCatalog).
  const catalog = useProductCatalog({ includeOutOfStock: true });
  const cart = useCart({ ignoreStockLimit: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    if (cart.cart.length === 0) return;
    setSaving(true);
    setError("");
    try {
      await onConfirm({
        cartItems: cart.cart.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity })),
        discountAmount: cart.discountAmount,
      });
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <>
      <div className="adm-modal-overlay" onClick={() => !saving && onDismiss()} />
      <div className="adm-modal pdv-fiado-order-modal" role="dialog" aria-modal="true">
        <h2 className="adm-store-section-title">Novo pedido — {customer.name}</h2>
        <p className="adm-store-section-desc">
          Escolha os produtos vendidos — entra como fiado na conta do cliente. O estoque só baixa quando
          o cliente pagar essa conta.
        </p>

        {error && <div className="adm-modal-error">⚠️ {error}</div>}

        <div className="pdv-fiado-order-body">
          <ProductCatalog
            search={catalog.search}
            setSearch={catalog.setSearch}
            productsError={catalog.productsError}
            productsLoading={catalog.productsLoading}
            filteredProducts={catalog.filteredProducts}
            addToCart={cart.addToCart}
          />

          <div className="pdv-cart">
            {cart.cart.length === 0 ? (
              <div className="adm-empty"><p>Nenhum item ainda.</p></div>
            ) : (
              <div className="pdv-cart-items">
                {cart.cart.map((item) => (
                  <div key={item.id} className="pdv-cart-item">
                    <div className="pdv-cart-item-info">
                      <span className="pdv-cart-item-name">{item.name}</span>
                      <span className="pdv-cart-item-price">{formatBRL(item.price)} un.</span>
                    </div>
                    <div className="pdv-cart-item-qty">
                      <button
                        type="button"
                        title="Diminuir quantidade"
                        onClick={() => cart.updateQuantity(item.id, item.quantity - 1)}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        className="pdv-cart-item-qty-input"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => cart.updateQuantity(item.id, Number(e.target.value))}
                      />
                      <button
                        type="button"
                        title="Aumentar quantidade"
                        onClick={() => cart.updateQuantity(item.id, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      className="adm-btn-delete"
                      title="Remover item"
                      onClick={() => cart.removeFromCart(item.id)}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="pdv-cart-summary">
              <div className="pdv-cart-subtotal-row">
                <span>Itens</span>
                <span>{formatBRL(cart.subtotal)}</span>
              </div>
              <div className="pdv-cart-total">
                <span>Total</span>
                <strong>{formatBRL(cart.cartTotal)}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="adm-store-form-actions">
          <button
            className="adm-btn-new-product"
            onClick={handleConfirm}
            disabled={saving || cart.cart.length === 0}
          >
            {saving ? "Registrando..." : "✅ Registrar pedido"}
          </button>
          <button className="adm-btn-back" onClick={onDismiss} disabled={saving}>
            Cancelar
          </button>
        </div>
      </div>
    </>
  );
}
