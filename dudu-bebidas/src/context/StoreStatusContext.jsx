import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../supabase/Supabaseclient";
import { getStoreStatus, createStoreChecker } from "../utils/storeHours";

// ── Dois contextos separados — interface de useStoreStatus não muda ───────────
const StoreStatusContext = createContext(null); // storeStatus object
const StoreHoursContext  = createContext(null); // { config, hours } raw data

export function StoreStatusProvider({ children }) {
  const [storeStatus, setStoreStatus] = useState(() => getStoreStatus());
  const [hoursData,   setHoursData]   = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [{ data: cfg, error: cfgErr }, { data: hrs, error: hrsErr }] =
          await Promise.all([
            supabase.from("store_config").select("*").eq("id", 1).single(),
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

/**
 * Retorna o status atual da loja { open, reason, message, shortMessage }.
 * Interface idêntica à anterior — nenhum consumer precisa mudar.
 */
export function useStoreStatus() {
  const ctx = useContext(StoreStatusContext);
  return ctx ?? getStoreStatus();
}

/**
 * Retorna os horários brutos do banco: { config, hours }
 * hours é um array com uma entrada por dia da semana (0=Dom … 6=Sáb).
 * Retorna null enquanto carrega ou se o banco não estiver disponível.
 */
export function useStoreHoursData() {
  return useContext(StoreHoursContext);
}
