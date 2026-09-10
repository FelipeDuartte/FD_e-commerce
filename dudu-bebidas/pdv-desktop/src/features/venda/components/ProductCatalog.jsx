import { formatBRL } from "../../../shared/utils/format";
import { getPdvPrice } from "../utils/pricing";

export default function ProductCatalog({ search, setSearch, productsError, productsLoading, filteredProducts, addToCart }) {
  // Leitor de código de barras funciona como teclado: digita o EAN e manda
  // um Enter sozinho. Sem isso, escanear só filtrava o card — o operador
  // ainda precisava clicar nele pra ir pro carrinho, um passo a mais por
  // item que anula a vantagem de usar o leitor.
  const handleSearchKeyDown = (e) => {
    if (e.key !== "Enter") return;
    const term = search.trim().toLowerCase();
    if (!term) return;
    const match = filteredProducts.find((p) => (p.ean ?? "").toLowerCase() === term);
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
        <div className="pdv-product-grid">
          {filteredProducts.map((p) => (
            <button key={p.id} className="pdv-product-card" onClick={() => addToCart(p)}>
              <span className="pdv-product-name">{p.name}</span>
              <span className="pdv-product-price">{formatBRL(getPdvPrice(p))}</span>
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
