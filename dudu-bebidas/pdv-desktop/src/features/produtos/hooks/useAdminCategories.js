import { useState, useEffect } from "react";
import { supabase } from "../../../shared/supabase/Supabaseclient";

/**
 * Busca categorias ativas da loja no banco para uso no PDV.
 * Sem lista reserva: antes havia as categorias de bebidas fixas aqui, e
 * uma loja de outro nicho veria "cerveja", "vinho"...
 *
 * Retorna um array de strings: ["cerveja", "vinho", ...]
 */
export function useAdminCategories() {
  const [categories, setCategories] = useState([]);
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

        if (!error && data) {
          setCategories(data.map((row) => row.name));
        }
      } catch {
        // sem categorias — o cadastro de produto pede pra escolher
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { categories, loading };
}
