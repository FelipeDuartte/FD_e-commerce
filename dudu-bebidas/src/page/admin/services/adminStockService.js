import { supabase } from "../../../supabase/Supabaseclient";
import { PAGE_SIZE } from "../adminUtils";
import { AdminServiceError } from "./AdminServiceError";

const REASON_LABEL = {
  venda: "Venda",
  cancelamento: "Cancelamento",
  ajuste_manual: "Ajuste manual",
};

export async function listStockMovements({ page = 0 } = {}) {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error, count } = await supabase
    .from("stock_movements")
    .select("id, product_name, quantity, reason, created_at, orders(channel)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw new AdminServiceError("Não foi possível carregar o histórico de estoque.", error);
  }

  const movements = (data ?? []).map((m) => {
    let origin = REASON_LABEL[m.reason] ?? m.reason;
    if (m.reason !== "ajuste_manual") {
      origin = m.orders?.channel === "balcao" ? "PDV" : "Online";
    }
    return {
      id: m.id,
      productName: m.product_name,
      quantity: m.quantity,
      reason: m.reason,
      origin,
      createdAt: m.created_at,
    };
  });

  return {
    movements,
    count: count ?? 0,
    hasMore: movements.length === PAGE_SIZE,
  };
}
