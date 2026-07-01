import { useState, useEffect } from "react";
import { supabase } from "../supabase/Supabaseclient";

// Fallback estático — usado enquanto carrega ou se o banco falhar.
// Mantém o mesmo formato/ordem que já existia hardcoded no ProductList.
const FALLBACK_CATEGORIES = [
  { id: "cerveja",      label: "Cervejas",      icon: "bi-cup-straw" },
  { id: "vinho",        label: "Vinhos",        icon: "bi-cup" },
  { id: "destilado",    label: "Destilados",    icon: "bi-droplet-fill" },
  { id: "refrigerante", label: "Refri / Sucos", icon: "bi-cup-straw" },
  { id: "energetico",   label: "Energéticos",   icon: "bi-lightning-charge-fill" },
  { id: "outros",       label: "Outros",        icon: "bi-bag" },
];

// Ícones por nome de categoria conhecida — categorias novas criadas pelo
// admin caem no ícone padrão "bi-tag".
const ICON_MAP = {
  cerveja:      "bi-cup-straw",
  vinho:        "bi-cup",
  destilado:    "bi-droplet-fill",
  refrigerante: "bi-cup-straw",
  energetico:   "bi-lightning-charge-fill",
  outros:       "bi-bag",
};

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Busca categorias ativas do banco e formata para a barra de filtros.
 * Sempre inclui a opção "Todos" no início.
 * Usa fallback estático em caso de erro ou enquanto carrega.
 */
export function useProductCategories() {
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        const { data, error } = await supabase
          .from("categories")
          .select("name")
          .eq("is_active", true)
          .order("name");

        if (cancelled) return;

        if (error) {
          console.warn("[useProductCategories] Usando fallback:", error.message);
        } else if (data && data.length > 0) {
          setCategories(
            data.map(({ name }) => ({
              id: name,
              label: capitalize(name),
              icon: ICON_MAP[name] ?? "bi-tag",
            }))
          );
        }
      } catch (e) {
        if (!cancelled) console.warn("[useProductCategories] Erro:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, []);

  // Sempre com "Todos" na frente
  const withAll = [
    { id: "todos", label: "Todos", icon: "bi-grid-fill" },
    ...categories,
  ];

  return { categories: withAll, loading };
}
