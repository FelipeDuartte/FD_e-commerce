import { useEffect, useRef } from "react";
import { supabase, getCurrentStoreId } from "../../../shared/supabase/Supabaseclient";

// Qualquer venda/compra/cancelamento/ajuste, de QUALQUER terminal, gera
// uma linha nova em stock_movements — sem isso o Histórico de estoque só
// atualizava reabrindo a aba ou o app inteiro. Sufixo único por instância
// do hook — mesma proteção de useProductsRealtime, pra nunca colidir se
// esse hook passar a ser usado em mais de um lugar ao mesmo tempo.
export function useStockMovementsRealtime(onChange) {
  const instanceId = useRef(Math.random().toString(36).slice(2));

  useEffect(() => {
    const storeId = getCurrentStoreId();
    const channel = supabase
      .channel(`pdv-stock-movements-${storeId}-${instanceId.current}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "stock_movements", filter: `store_id=eq.${storeId}` },
        onChange,
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [onChange]);
}
