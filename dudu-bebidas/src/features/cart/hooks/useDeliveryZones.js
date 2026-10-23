import { useState, useEffect } from "react";
import { supabase } from "../../../shared/supabase/Supabaseclient";

/**
 * Busca as zonas de entrega ativas do Supabase.
 * Retorna apenas zonas ativas, ordenadas por sort_order.
 * Sem lista reserva: antes havia os bairros da Dudu fixos aqui, e uma loja
 * sem bairros cadastrados (ou com erro no banco) mostrava os da Dudu.
 *
 * @returns {{ zones: Array, loading: boolean }}
 */
export function useDeliveryZones() {
  const [zones, setZones] = useState([]);
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
          console.warn("[useDeliveryZones] Erro ao carregar bairros:", error.message);
        } else {
          setZones(data ?? []);
        }
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
