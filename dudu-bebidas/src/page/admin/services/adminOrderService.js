import { supabase } from "../../../supabase/Supabaseclient";
import { PAGE_SIZE } from "../adminUtils";
import { AdminServiceError } from "./AdminServiceError";

const ORDER_SELECT = `
  id,
  total,
  payment_method,
  installments,
  address,
  status,
  created_at,
  order_items ( id, name, price, quantity )
`;

export function getOrdersBoundary() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

export async function listAdminOrders({ page = 0, status = "all" }) {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const boundary = getOrdersBoundary();

  let query = supabase
    .from("orders")
    .select(ORDER_SELECT, { count: "exact" })
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

  const { data, count, error } = await supabase
    .from("orders")
    .select("total", { count: "exact" })
    .gte("created_at", today.toISOString())
    .lt("created_at", tomorrow.toISOString());

  if (error) {
    throw new AdminServiceError(
      "Não foi possível carregar as métricas.",
      error,
    );
  }

  return {
    count: count ?? 0,
    total: (data ?? []).reduce((sum, order) => sum + (order.total ?? 0), 0),
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