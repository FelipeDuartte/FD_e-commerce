import { useState, useEffect } from "react";
import { supabase } from "../../../shared/supabase/Supabaseclient";
import { CATEGORIES as FALLBACK } from "../utils/productConstants";

/**
 * Busca categorias ativas do banco para uso no PDV.
 * Se o banco falhar ou retornar vazio, usa o array estático
 * de productConstants.js como fallback (sem quebrar nada).
 *
 * Retorna um array de strings: ["cerveja", "vinho", ...]
 */
export function useAdminCategories() {
  const [categories, setCategories] = useState(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data, error } = await supabase
          .from("categories")
          .select("name")
          .eq("is_active", true)
          .order("name");

        if (cancelled) return;

        if (!error && data && data.length > 0) {
          setCategories(data.map((row) => row.name));
        }
        // se retornar vazio ou erro, mantém FALLBACK silenciosamente
      } catch {
        // mantém fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { categories, loading };
}
