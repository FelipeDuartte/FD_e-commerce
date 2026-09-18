import { supabase } from "../../../../shared/supabase/Supabaseclient";
import { AdminServiceError } from "../../../shared/services/AdminServiceError";

// Máximo de linhas que o Supabase retorna por request — usado para paginar
// tanto a busca de pedidos quanto a de itens de pedido (evita truncar dados
// silenciosamente em lojas com muitos pedidos).
const REPORTS_PAGE_SIZE = 1000;

/** ISO string for the 1st of the month, N months ago */
function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Fetches ALL orders from the last 12 months with automatic pagination.
 *
 * Supabase returns at most 1 000 rows per request by default. This loop
 * keeps fetching until it gets a page smaller than REPORTS_PAGE_SIZE, guaranteeing
 * that stores with thousands of orders never receive truncated data silently.
 */
export async function fetchOrdersForReports() {
  const cutoff = monthsAgo(12);
  const allOrders = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("orders")
      .select("id, total, card_fee_amount, created_at, address")
      .gte("created_at", cutoff)
      // Só conta pedido já recebido (delivered) — em aberto ainda não virou
      // dinheiro, e rejeitado/cancelado nunca vira. Filtra aqui (não em
      // summariseOrders) porque também corta os order_items buscados logo
      // depois (fetchOrderItemsForReports só recebe os IDs que sobraram).
      .eq("status", "delivered")
      .order("created_at", { ascending: true })
      .range(from, from + REPORTS_PAGE_SIZE - 1);

    if (error) {
      throw new AdminServiceError(
        "Não foi possível carregar dados para relatórios.",
        error,
      );
    }

    const rows = data ?? [];
    allOrders.push(...rows);

    // Fewer rows than REPORTS_PAGE_SIZE → last page reached
    if (rows.length < REPORTS_PAGE_SIZE) break;
    from += REPORTS_PAGE_SIZE;
  }

  return allOrders;
}

/**
 * Fetches ALL order_items for the given order IDs with automatic pagination.
 *
 * Two layers of batching:
 *  1. The ID list is split into chunks of 500 to stay within URL-length limits
 *     when Supabase serialises the `in` filter.
 *  2. Each chunk is itself paginated (1 000 rows/page) so a busy chunk with
 *     many items per order is also fully retrieved.
 */
export async function fetchOrderItemsForReports(orderIds) {
  if (!orderIds.length) return [];

  const ID_CHUNK = 500;  // max IDs per `.in()` call

  // Split orderIds into safe chunks for the `.in()` filter
  const idChunks = [];
  for (let i = 0; i < orderIds.length; i += ID_CHUNK) {
    idChunks.push(orderIds.slice(i, i + ID_CHUNK));
  }

  const allItems = [];

  for (const ids of idChunks) {
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("order_items")
        .select("order_id, name, quantity, price")
        .in("order_id", ids)
        .range(from, from + REPORTS_PAGE_SIZE - 1);

      if (error) {
        throw new AdminServiceError(
          "Não foi possível carregar itens dos pedidos.",
          error,
        );
      }

      const rows = data ?? [];
      allItems.push(...rows);

      if (rows.length < REPORTS_PAGE_SIZE) break;
      from += REPORTS_PAGE_SIZE;
    }
  }

  return allItems;
}
