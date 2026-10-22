import { memo } from "react";
import { formatBRL } from "../../../shared/utils/format";
import { getPdvPrice, getPdvPromoPrice } from "../utils/pricing";

// Grade separada e memorizada: só redesenha quando a lista filtrada ou o
// addToCart mudam. Digitar no carrinho (desconto, troco, entrega) ou na
// busca não redesenha mais os ~370 cards a cada tecla.
const ProductGrid = memo(function ProductGrid({ products, addToCart }) {
  return (
    <div className="pdv-product-grid">
      {products.map((p) => {
        const promoPrice = getPdvPromoPrice(p);
        return (
          <div key={p.id} className="pdv-product-card">
            <button type="button" className="pdv-product-card-main" onClick={() => addToCart(p)} tabIndex={-1}>
              <span className="pdv-product-name">{p.name}</span>
              <span className="pdv-product-price">{formatBRL(getPdvPrice(p))}</span>
              <span className={`adm-stock-badge ${p.stock < 10 ? "low" : "ok"}`}>
                {p.stock} em estoque
              </span>
            </button>
            {/* Promoção do PDV (cadastrada no produto) — o operador escolhe
                aplicar em cada venda. A promoção do site não vale aqui. */}
            {promoPrice != null && (
              <button
                type="button"
                className="pdv-product-promo-btn"
                onClick={() => addToCart(p, { usePromoPrice: true })}
                title={`Vender no preço promocional do PDV: ${formatBRL(promoPrice)}`}
                tabIndex={-1}
              >
                🏷️ Aplicar promoção · {formatBRL(promoPrice)}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
});

function ProductCatalog({ search, setSearch, productsError, productsLoading, filteredProducts, findByEan, addToCart }) {
  // Leitor de código de barras funciona como teclado: digita o EAN e manda
  // um Enter sozinho. Sem isso, escanear só filtrava o card — o operador
  // ainda precisava clicar nele pra ir pro carrinho, um passo a mais por
  // item que anula a vantagem de usar o leitor.
  const handleSearchKeyDown = (e) => {
    if (e.key !== "Enter") return;
    const match = findByEan(search);
    if (match) {
      addToCart(match);
      setSearch("");
    }
  };

  return (
    <div className="pdv-catalog">
      <input
        className="adm-product-search"
        placeholder="🔍 Buscar por nome ou código de barras..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={handleSearchKeyDown}
        autoFocus
      />

      {productsError && <div className="adm-modal-error">⚠️ {productsError}</div>}

      {productsLoading ? (
        <div className="adm-loading">
          <div className="adm-spinner" />
          <p>Carregando produtos...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="adm-empty"><p>Nenhum produto encontrado.</p></div>
      ) : (
        <ProductGrid products={filteredProducts} addToCart={addToCart} />
      )}
    </div>
  );
}

export default memo(ProductCatalog);
