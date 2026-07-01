import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../supabase/Supabaseclient";
import { getStoreStatus, createStoreChecker } from "../utils/storeHours";

// ── Contexto ──────────────────────────────────────────────────────────────────
const StoreStatusContext = createContext(null);

/**
 * Carrega os horários do banco UMA VEZ e disponibiliza para toda a árvore.
 * Enquanto carrega usa o status estático (comportamento atual) como fallback.
 */
export function StoreStatusProvider({ children }) {
  const [storeStatus, setStoreStatus] = useState(() => getStoreStatus());

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

        // Se qualquer tabela falhar, mantém o fallback estático sem erro visível
        if (cfgErr || hrsErr || !cfg || !hrs) return;

        const checker = createStoreChecker(cfg, hrs);
        setStoreStatus(checker.getStatus());
      } catch {
        // Mantém o fallback estático — tabelas podem não existir ainda
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <StoreStatusContext.Provider value={storeStatus}>
      {children}
    </StoreStatusContext.Provider>
  );
}

/**
 * Hook para consumir o status da loja em qualquer componente filho.
 * Retorna o mesmo objeto { open, reason, message, shortMessage } que getStoreStatus().
 */
export function useStoreStatus() {
  const ctx = useContext(StoreStatusContext);
  // Fallback seguro caso seja usado fora do Provider
  return ctx ?? getStoreStatus();
}
