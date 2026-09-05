import { useCallback, useEffect, useMemo, useState } from "react";
import { listAdminProducts } from "../../produtos/services/productService";

// Catálogo de produtos pra venda — carrega a lista e filtra por busca
// (nome/id/EAN), só produtos ativos e com estoque. Independente de
// carrinho/pagamento; useSale chama `reload` depois de finalizar/cancelar
// uma venda pra refletir o estoque atualizado.
export function useProductCatalog() {
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

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products
      .filter((p) => p.is_active && p.stock > 0)
      .filter(
        (p) =>
          !term ||
          p.name.toLowerCase().includes(term) ||
          p.id.toLowerCase().includes(term) ||
          (p.ean ?? "").toLowerCase() === term
      );
  }, [products, search]);

  return {
    products, productsLoading, productsError, search, setSearch,
    filteredProducts, reload: loadProducts,
  };
}
