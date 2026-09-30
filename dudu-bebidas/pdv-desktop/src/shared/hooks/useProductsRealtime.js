import { useEffect } from "react";
import { supabase, getCurrentStoreId } from "../supabase/Supabaseclient";

// products muda de estoque em QUALQUER venda/compra/cancelamento — de
// qualquer terminal. Sem isso, o catálogo da Venda e a lista de Produtos só
// atualizavam quando o PRÓPRIO terminal mexia em algo, ou reiniciando o
// app inteiro. Mesmo padrão de useSaleRealtime/useFiadoRealtime, só que
// escutando a tabela products inteira da loja.
export function useProductsRealtime(onChange) {
  useEffect(() => {
    const storeId = getCurrentStoreId();
    const channel = supabase
      .channel(`pdv-products-${storeId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "products", filter: `store_id=eq.${storeId}` },
        onChange,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "products", filter: `store_id=eq.${storeId}` },
        onChange,
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [onChange]);
}
