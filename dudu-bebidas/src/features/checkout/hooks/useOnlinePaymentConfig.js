import { useEffect, useState } from "react";
import { supabase, getCurrentStoreId } from "../../../shared/supabase/Supabaseclient";

// A loja tem pagamento online (InfinitePay) configurado? Só um sim/não —
// a chave da InfinitePay nunca sai do servidor (get_online_payment_config,
// migration 0057).
export function useOnlinePaymentConfig() {
  const [infinitepay, setInfinitepay] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .rpc("get_online_payment_config", { p_store_id: getCurrentStoreId() })
      .then(({ data, error }) => {
        if (error) console.warn("[useOnlinePaymentConfig]", error.message);
        if (cancelled) return;
        setInfinitepay(Boolean(data?.infinitepay));
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  return { infinitepay, loaded };
}
