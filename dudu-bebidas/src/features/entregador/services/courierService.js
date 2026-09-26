import { supabase } from "../../../shared/supabase/Supabaseclient";
import { formatAddressText } from "../../../shared/utils/geo";

// Pedidos atribuídos ao entregador logado — RLS (orders_courier_read_assigned)
// já garante que só vem o que é dele, mesmo sem filtrar courier_id aqui.
export async function listMyDeliveries() {
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, total, payment_method, installments, address, status, created_at, on_the_way_at")
    .in("status", ["preparing", "on_the_way"])
    .order("created_at", { ascending: true });

  if (error) throw new Error("Não foi possível carregar suas entregas.");
  return data ?? [];
}

export async function shareLocation(lat, lng) {
  const { data, error } = await supabase.rpc("upsert_courier_location", { p_lat: lat, p_lng: lng });
  if (error || !data?.success) {
    console.error("[shareLocation] erro:", error ?? data?.error);
    return false;
  }
  return true;
}

export async function advanceDeliveryStatus(orderId) {
  const { data, error } = await supabase.rpc("courier_advance_order_status", {
    p_order_id: orderId,
  });

  if (error) throw new Error("Não foi possível atualizar o pedido.");
  if (!data?.success) throw new Error(data?.error ?? "Não foi possível atualizar o pedido.");
  return data.status;
}

// Monta a URL de busca do Google Maps a partir do endereço em texto — sem
// geocodificação (não existe lat/lng no sistema ainda, ver Fase 2).
export function mapsUrlFor(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatAddressText(address))}`;
}
