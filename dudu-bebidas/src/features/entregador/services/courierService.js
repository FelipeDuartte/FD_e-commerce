import { supabase } from "../../../shared/supabase/Supabaseclient";

// Pedidos atribuídos ao entregador logado — RLS (orders_courier_read_assigned)
// já garante que só vem o que é dele, mesmo sem filtrar courier_id aqui.
export async function listMyDeliveries() {
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, total, payment_method, installments, address, status, created_at")
    .in("status", ["preparing", "on_the_way"])
    .order("created_at", { ascending: true });

  if (error) throw new Error("Não foi possível carregar suas entregas.");
  return data ?? [];
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
  const parts = [address?.street, address?.number, address?.district, address?.city, address?.state]
    .filter(Boolean)
    .join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts)}`;
}
