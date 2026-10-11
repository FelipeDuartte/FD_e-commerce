import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { useLiveProducts } from "../../../shared/hooks/useLiveProducts";

// Catálogo de produtos pra venda — filtra a lista ao vivo (useLiveProducts)
// por busca (nome/id/EAN), só produtos ativos e com estoque. Independente de
// carrinho/pagamento; useSale chama `reload` depois de finalizar/cancelar
// uma venda como garantia extra além do realtime.
//
// includeOutOfStock: true mostra produto com 0 em estoque também — usado
// só pelo pedido fiado com baixa adiada (NewFiadoOrderModal), onde o dono
// pode estar vendendo algo que o fornecedor ainda vai entregar antes da
// data combinada com o cliente. Mesmo raciocínio de ignoreStockLimit em
// useCart.js.
export function useProductCatalog({ includeOutOfStock = false } = {}) {
  const { products, loading: productsLoading, error: productsError, reload } = useLiveProducts();
  const [search, setSearch] = useState("");
  // O campo de busca atualiza na hora; o filtro da grade usa a versão
  // "adiada" — o React desenha a letra digitada primeiro e só depois
  // refiltra/redesenha os cards, então digitar nunca espera a grade.
  const deferredSearch = useDeferredValue(search);

  const sellable = useMemo(
    () => products.filter((p) => p.is_active && (includeOutOfStock || p.stock > 0)),
    [products, includeOutOfStock],
  );

  const filteredProducts = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    return sellable.filter(
      (p) =>
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.id.toLowerCase().includes(term) ||
        (p.ean ?? "").toLowerCase() === term,
    );
  }, [sellable, deferredSearch]);

  // Leitor de código de barras digita o EAN + Enter muito rápido — procura
  // na lista inteira, não na grade filtrada (que pode ainda estar com a
  // busca adiada de uma tecla antes).
  const findByEan = useCallback(
    (ean) => {
      const term = ean.trim().toLowerCase();
      return term ? sellable.find((p) => (p.ean ?? "").toLowerCase() === term) ?? null : null;
    },
    [sellable],
  );

  return {
    products, productsLoading, productsError, search, setSearch,
    filteredProducts, findByEan, reload,
  };
}
