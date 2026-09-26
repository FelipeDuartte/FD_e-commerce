import { supabase } from "../../../../shared/supabase/Supabaseclient";
import { PAGE_SIZE, isPhantomMercadoPagoOrder } from "../orderStatus";
import { AdminServiceError } from "../../../shared/services/AdminServiceError";
import { geocodeAddress, formatAddressText } from "../../../../shared/utils/geo";

const ORDER_SELECT = `
  id,
  order_number,
  total,
  discount_amount,
  payment_method,
  payment_status,
  payment_provider,
  customer_claimed_paid_at,
  installments,
  address,
  status,
  created_at,
  channel,
  courier_id,
  courier_name,
  courier_phone,
  order_items ( id, name, price, quantity )
`;

export function getOrdersBoundary() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

export async function listAdminOrders({ page = 0, status = "all" }) {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const boundary = getOrdersBoundary();

  // Venda de balcão (PDV) não aparece aqui — tem histórico e relatório
  // próprios no PDV, misturar com o painel do site só atrapalha o dono.
  let query = supabase
    .from("orders")
    .select(ORDER_SELECT, { count: "exact" })
    .eq("channel", "online")
    .order("created_at", { ascending: false })
    .range(from, to);

  // "pending" (Aguardando) nunca some sozinho — precisa de ação. Qualquer
  // outro status (preparing, on_the_way, delivered, rejected) só fica
  // visível até 24h depois de criado — depois disso, arquiva.
  if (status === "all") {
    query = query.or(`status.eq.pending,created_at.gte.${boundary}`);
  } else if (status === "pending") {
    query = query.eq("status", status);
  } else {
    query = query.eq("status", status).gte("created_at", boundary);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new AdminServiceError("Não foi possível carregar os pedidos.", error);
  }

  return {
    orders: data ?? [],
    count: count ?? 0,
    hasMore: (data ?? []).length === PAGE_SIZE,
  };
}

export async function getTodayOrderMetrics() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { data, error } = await supabase
    .from("orders")
    .select("total, payment_provider, payment_status")
    .eq("channel", "online")
    .gte("created_at", today.toISOString())
    .lt("created_at", tomorrow.toISOString());

  if (error) {
    throw new AdminServiceError(
      "Não foi possível carregar as métricas.",
      error,
    );
  }

  // Cartão online recusado/cancelado/expirado nunca virou venda de verdade —
  // não deve contar em "pedidos hoje" nem em "vendas hoje" (mesmo critério
  // usado pra escondê-lo da lista de pedidos, ver isPhantomMercadoPagoOrder).
  const realOrders = (data ?? []).filter((o) => !isPhantomMercadoPagoOrder(o));

  return {
    count: realOrders.length,
    total: realOrders.reduce((sum, order) => sum + (order.total ?? 0), 0),
  };
}

export async function updateAdminOrderStatus(orderId, status) {
  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId);

  if (error) {
    throw new AdminServiceError("Não foi possível atualizar o pedido.", error);
  }
}

export async function assignCourierToOrder(orderId, courier, address) {
  // Geocodifica o destino UMA vez, aqui — nunca de novo depois (fica
  // salvo em orders.delivery_lat/lng). Se falhar (endereço ruim, Mapbox
  // fora do ar), a atribuição continua normalmente, só sem pino de mapa
  // pra esse pedido — geocodificação nunca deve travar o essencial.
  const location = await geocodeAddress(formatAddressText(address));

  const { error } = await supabase
    .from("orders")
    .update({
      courier_id: courier.id,
      courier_name: courier.name,
      courier_phone: courier.phone,
      ...(location ? { delivery_lat: location.lat, delivery_lng: location.lng } : {}),
    })
    .eq("id", orderId);

  if (error) {
    throw new AdminServiceError("Não foi possível atribuir o entregador.", error);
  }
}

export async function rejectAdminOrder(orderId) {
  // Antes apagava o pedido e os itens; agora só marca como "rejected" —
  // o pedido continua no histórico (e some do painel depois de 24h, igual
  // aos outros status, via shouldRemoveOrder/listAdminOrders).
  const { error } = await supabase
    .from("orders")
    .update({ status: "rejected" })
    .eq("id", orderId);

  if (error) {
    throw new AdminServiceError("Erro ao rejeitar pedido.", error);
  }
}