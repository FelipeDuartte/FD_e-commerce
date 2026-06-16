import { supabase } from "../../../supabase/Supabaseclient";
import { PAGE_SIZE } from "../adminUtils";
import { AdminServiceError } from "./AdminServiceError";

const ORDER_SELECT = `
  id,
  total,
  payment_method,
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

  if (status === "all") {
    query = query.or(`status.not.eq.delivered,created_at.gte.${boundary}`);
  } else if (status === "delivered") {
    query = query.eq("status", "delivered").gte("created_at", boundary);
  } else {
    query = query.eq("status", status);
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
    throw new AdminServiceError("Não foi possível carregar as métricas.", error);
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
  // Marca como "rejected" primeiro: dispara o evento realtime para o
  // cliente avisar o usuário antes que o pedido seja apagado abaixo.
  const { error: statusError } = await supabase
    .from("orders")
    .update({ status: "rejected" })
    .eq("id", orderId);

  if (statusError) {
    throw new AdminServiceError("Erro ao rejeitar pedido.", statusError);
  }

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "restore_stock",
    { p_order_id: orderId },
  );

  if (rpcError || !rpcResult?.success) {
    throw new AdminServiceError(
      rpcError
        ? "Erro ao restaurar estoque."
        : (rpcResult?.error ?? "Erro ao restaurar estoque."),
      rpcError,
    );
  }

  const { error: itemsError } = await supabase
    .from("order_items")
    .delete()
    .eq("order_id", orderId);

  if (itemsError) {
    throw new AdminServiceError("Erro ao remover itens.", itemsError);
  }

  const { error: orderError } = await supabase
    .from("orders")
    .delete()
    .eq("id", orderId);

  if (orderError) {
    throw new AdminServiceError("Erro ao rejeitar pedido.", orderError);
  }
}