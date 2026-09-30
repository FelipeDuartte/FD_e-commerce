import { useEffect } from "react";
import { supabase, getCurrentStoreId } from "../../../shared/supabase/Supabaseclient";

// Qualquer venda/compra/cancelamento/ajuste, de QUALQUER terminal, gera
// uma linha nova em stock_movements — sem isso o Histórico de estoque só
// atualizava reabrindo a aba ou o app inteiro.
export function useStockMovementsRealtime(onChange) {
  useEffect(() => {
    const storeId = getCurrentStoreId();
    const channel = supabase
      .channel(`pdv-stock-movements-${storeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "stock_movements", filter: `store_id=eq.${storeId}` },
        onChange,
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [onChange]);
}
