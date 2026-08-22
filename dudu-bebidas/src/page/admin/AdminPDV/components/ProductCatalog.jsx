import { formatBRL } from "../../adminUtils";

export default function ProductCatalog({ search, setSearch, productsError, productsLoading, filteredProducts, addToCart }) {
  return (
    <div className="pdv-catalog">
      <input
        className="adm-product-search"
        placeholder="🔍 Buscar por nome ou código de barras..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
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
        <div className="pdv-product-grid">
          {filteredProducts.map((p) => (
            <button key={p.id} className="pdv-product-card" onClick={() => addToCart(p)}>
              <span className="pdv-product-name">{p.name}</span>
              <span className="pdv-product-price">{formatBRL(p.price)}</span>
              <span className={`adm-stock-badge ${p.stock < 10 ? "low" : "ok"}`}>
                {p.stock} em estoque
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
