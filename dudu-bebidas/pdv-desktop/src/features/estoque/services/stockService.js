import { supabase } from "../../../shared/supabase/Supabaseclient";
import { PAGE_SIZE } from "../../../shared/constants";
import { AdminServiceError } from "../../../shared/services/AdminServiceError";

const REASON_LABEL = {
  venda: "Venda",
  cancelamento: "Cancelamento",
  ajuste_manual: "Ajuste manual",
};

export async function listStockMovements({ page = 0, reason = "todos", search = "" } = {}) {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("stock_movements")
    .select("id, product_name, quantity, reason, created_at, orders(channel)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (reason !== "todos") query = query.eq("reason", reason);
  const trimmedSearch = search.trim();
  if (trimmedSearch) query = query.ilike("product_name", `%${trimmedSearch}%`);

  const { data, error, count } = await query.range(from, to);

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
