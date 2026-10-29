import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listAdminProducts } from "../../features/produtos/services/productService";
import { useProductsRealtime } from "./useProductsRealtime";

const byName = (a, b) => a.name.localeCompare(b.name, "pt-BR");

// Aplica linhas alteradas na lista sem baixar tudo de novo. Só reordena
// quando entrou produto novo ou mudou nome — senão mantém a ordem do banco.
function mergeRows(prev, rows) {
  const next = [...prev];
  const indexById = new Map(next.map((p, i) => [p.id, i]));
  let needsSort = false;
  for (const row of rows) {
    const i = indexById.get(row.id);
    if (i === undefined) {
      indexById.set(row.id, next.push(row) - 1);
      needsSort = true;
    } else {
      if (row.name !== undefined && row.name !== next[i].name) needsSort = true;
      next[i] = { ...next[i], ...row };
    }
  }
  return needsSort ? next.sort(byName) : next;
}

// Lista de produtos da loja sempre atualizada (Venda e aba Produtos).
// - "Carregando" só no primeiro carregamento; recargas depois disso são
//   silenciosas, a lista na tela nunca some.
// - Mudanças de outros terminais/site chegam pelo realtime e são aplicadas
//   linha a linha (ver useProductsRealtime).
// - Recargas sobrepostas: só a resposta mais recente vale (uma resposta
//   antiga chegando por último não sobrescreve estoque mais novo).
export function useLiveProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const hasLoadedRef = useRef(false);
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const data = await listAdminProducts();
      if (requestId !== requestIdRef.current) return;
      hasLoadedRef.current = true;
      setProducts(data);
      setError("");
    } catch (e) {
      console.error(e);
      if (requestId !== requestIdRef.current) return;
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // O realtime manda a linha de products, onde custo e fornecedor estão
  // sempre vazios (eles vivem em product_costs) — sem tirar, apagaria o
  // valor que veio do carregamento.
  const applyRows = useCallback((rows) => {
    const publicRows = rows.map(({ cost_price, supplier, ...row }) => row);
    setProducts((prev) => mergeRows(prev, publicRows));
  }, []);

  useProductsRealtime(applyRows, reload);

  // Produto excluído com histórico (deleted_at) fica guardado mas não aparece
  // em lista nenhuma. allProducts (com eles) serve pra gerar o próximo código
  // sem repetir o de um excluído.
  const visibleProducts = useMemo(() => products.filter((p) => !p.deleted_at), [products]);

  return { products: visibleProducts, allProducts: products, setProducts, loading, error, reload };
}
