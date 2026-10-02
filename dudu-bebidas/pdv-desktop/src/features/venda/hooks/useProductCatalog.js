import { useCallback, useEffect, useMemo, useState } from "react";
import { listAdminProducts } from "../../produtos/services/productService";
import { useProductsRealtime } from "../../../shared/hooks/useProductsRealtime";

// Catálogo de produtos pra venda — carrega a lista e filtra por busca
// (nome/id/EAN), só produtos ativos e com estoque. Independente de
// carrinho/pagamento; useSale chama `reload` depois de finalizar/cancelar
// uma venda pra refletir o estoque atualizado.
//
// includeOutOfStock: true mostra produto com 0 em estoque também — usado
// só pelo pedido fiado com baixa adiada (NewFiadoOrderModal), onde o dono
// pode estar vendendo algo que o fornecedor ainda vai entregar antes da
// data combinada com o cliente. Mesmo raciocínio de ignoreStockLimit em
// useCart.js.
export function useProductCatalog({ includeOutOfStock = false } = {}) {
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [search, setSearch] = useState("");

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      setProducts(await listAdminProducts());
      setProductsError("");
    } catch (e) {
      setProductsError(e.message);
    }
    setProductsLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadProducts]);

  // Recarrega quando OUTRO terminal vende/cadastra/muda estoque de um
  // produto — sem isso o catálogo da Venda ficava com preço/estoque
  // desatualizado até esse mesmo terminal vender algo ou reiniciar o app.
  useProductsRealtime(loadProducts);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products
      .filter((p) => p.is_active && (includeOutOfStock || p.stock > 0))
      .filter(
        (p) =>
          !term ||
          p.name.toLowerCase().includes(term) ||
          p.id.toLowerCase().includes(term) ||
          (p.ean ?? "").toLowerCase() === term
      );
  }, [products, search, includeOutOfStock]);

  return {
    products, productsLoading, productsError, search, setSearch,
    filteredProducts, reload: loadProducts,
  };
}
