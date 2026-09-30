import { useEffect } from "react";
import { supabase, getCurrentStoreId } from "../../../shared/supabase/Supabaseclient";

// Sem isso, se um terminal fechasse o caixa, os outros continuavam
// mostrando "caixa aberto" até reiniciar o app — e toda venda falhava na
// hora de finalizar (o servidor já rejeitava, só a tela é que não sabia).
// Mesmo vale pro inverso: outro terminal abrindo o caixa do dia.
export function useCashSessionRealtime(onChange) {
  useEffect(() => {
    const storeId = getCurrentStoreId();
    const channel = supabase
      .channel(`pdv-cash-sessions-${storeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "cash_sessions", filter: `store_id=eq.${storeId}` },
        onChange,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "cash_sessions", filter: `store_id=eq.${storeId}` },
        onChange,
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [onChange]);
}
