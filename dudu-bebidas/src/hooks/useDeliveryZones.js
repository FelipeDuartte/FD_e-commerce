import { useState, useEffect } from "react";
import { supabase } from "../supabase/Supabaseclient";

// Fallback estático: mantém os bairros originais do projeto caso o banco
// ainda não tenha a tabela delivery_zones criada ou ocorra algum erro.
const FALLBACK_ZONES = [
  { id: "retirada", nome: "Retirada na Loja", frete: 0, is_retirada: true, is_active: true, sort_order: 0 },
  { id: "minas-caixas", nome: "Minas Caixas", frete: 3.20, is_retirada: false, is_active: true, sort_order: 1 },
  { id: "serra-verde", nome: "Serra Verde", frete: 5.20, is_retirada: false, is_active: true, sort_order: 2 },
  { id: "parque-sao-pedro", nome: "Parque São Pedro", frete: 3.20, is_retirada: false, is_active: true, sort_order: 3 },
  { id: "venda-nova", nome: "Venda Nova", frete: 5.20, is_retirada: false, is_active: true, sort_order: 4 },
];

/**
 * Busca as zonas de entrega ativas do Supabase.
 * Retorna apenas zonas ativas, ordenadas por sort_order.
 * Usa os dados estáticos como fallback se o banco falhar.
 *
 * @returns {{ zones: Array, loading: boolean }}
 */
export function useDeliveryZones() {
  const [zones, setZones] = useState(FALLBACK_ZONES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        const { data, error } = await supabase
          .from("delivery_zones")
          .select("*")
          .eq("is_active", true)
          .order("sort_order");

        if (cancelled) return;

        if (error) {
          // Tabela pode não existir ainda — mantém fallback em silêncio
          console.warn("[useDeliveryZones] Usando fallback estático:", error.message);
        } else if (data && data.length > 0) {
          setZones(data);
        }
        // Se data estiver vazio mas sem erro, mantém o fallback para evitar
        // deixar o dropdown vazio após uma migração incompleta.
      } catch (e) {
        if (!cancelled) console.warn("[useDeliveryZones] Erro ao carregar bairros:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, []);

  return { zones, loading };
}
