import { useState, useEffect } from "react";
import { supabase, getCurrentStoreId } from "../supabase/Supabaseclient";
import { getStoreStatus, createStoreChecker } from "../utils/storeHours";
import { StoreHoursContext, StoreStatusContext } from "./storeStatusContexts";

export function StoreStatusProvider({ children }) {
  const [storeStatus, setStoreStatus] = useState(() => getStoreStatus());
  const [hoursData,   setHoursData]   = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [{ data: cfg, error: cfgErr }, { data: hrs, error: hrsErr }] =
          await Promise.all([
            supabase.from("store_config").select("*").eq("store_id", getCurrentStoreId()).single(),
            supabase.from("store_hours").select("*").order("day_of_week"),
          ]);

        if (cancelled) return;
        if (cfgErr || hrsErr || !cfg || !hrs) return;

        const checker = createStoreChecker(cfg, hrs);
        setStoreStatus(checker.getStatus());
        setHoursData({ config: cfg, hours: hrs });
      } catch {
        // Mantém fallback estático
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <StoreStatusContext.Provider value={storeStatus}>
      <StoreHoursContext.Provider value={hoursData}>
        {children}
      </StoreHoursContext.Provider>
    </StoreStatusContext.Provider>
  );
}
