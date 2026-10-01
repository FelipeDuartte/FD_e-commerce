import { useEffect, useRef } from "react";
import { supabase, getCurrentStoreId } from "../../../shared/supabase/Supabaseclient";

// Mesmo padrão dos outros — sem isso, uma conta paga/criada num terminal
// só aparecia atualizada nos outros reabrindo a aba ou o app. Sufixo único
// por instância do hook — mesma proteção de useProductsRealtime.
export function useAccountsPayableRealtime(onChange) {
  const instanceId = useRef(Math.random().toString(36).slice(2));

  useEffect(() => {
    const storeId = getCurrentStoreId();
    const channel = supabase
      .channel(`pdv-accounts-payable-${storeId}-${instanceId.current}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "accounts_payable", filter: `store_id=eq.${storeId}` },
        onChange,
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [onChange]);
}
