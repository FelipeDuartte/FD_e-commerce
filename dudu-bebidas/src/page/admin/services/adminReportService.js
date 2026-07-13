import { supabase } from "../../../supabase/Supabaseclient";
import { AdminServiceError } from "./AdminServiceError";

// Máximo de linhas que o Supabase retorna por request — usado para paginar
// tanto a busca de pedidos quanto a de itens de pedido (evita truncar dados
// silenciosamente em lojas com muitos pedidos).
const REPORTS_PAGE_SIZE = 1000;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** ISO string for the 1st of the month, N months ago */
function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Aggregate flat order rows into a 12-month array.
 * Returns entries ordered oldest → newest, one per month.
 */
function buildMonthlyBuckets(orders, numMonths = 12) {
  const buckets = {};

  for (let i = numMonths - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", {
      month: "short",
      year: "2-digit",
    });
    buckets[key] = { key, label, revenue: 0, count: 0 };
  }

  for (const order of orders) {
    const d = new Date(order.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key in buckets) {
      buckets[key].revenue += order.total ?? 0;
      buckets[key].count += 1;
    }
  }

  return Object.values(buckets);
}

// ── Fetches com paginação ─────────────────────────────────────────────────────

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
      .select("id, total, created_at, address")
      .gte("created_at", cutoff)
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

// ── Aggregation helpers (pure, safe to unit-test) ─────────────────────────────

/** Returns the 12-month bucketed data from raw orders. */
export function aggregateMonthly(orders) {
  return buildMonthlyBuckets(orders, 12);
}

/** Returns top N products sorted by quantity sold. */
export function aggregateTopProducts(items, limit = 10) {
  const map = {};
  for (const item of items) {
    const name = item.name?.trim();
    if (!name) continue;
    if (!map[name]) map[name] = { name, quantity: 0, revenue: 0 };
    map[name].quantity += item.quantity ?? 0;
    map[name].revenue += (item.price ?? 0) * (item.quantity ?? 0);
  }
  return Object.values(map)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, limit);
}

/**
 * Returns top N customers sorted by total spent.
 * Customers are identified by phone; orders without phone fall back to name.
 */
export function aggregateTopCustomers(orders, limit = 10) {
  const map = {};
  for (const order of orders) {
    const addr = order.address ?? {};
    const phone = addr.phone?.trim();
    const name = addr.name?.trim();

    if (!phone && !name) continue;

    const key = phone || name;
    const displayName =
      name && phone ? `${name} — ${phone}` : name || phone;

    if (!map[key]) {
      map[key] = { displayName, total: 0, count: 0 };
    }
    map[key].total += order.total ?? 0;
    map[key].count += 1;
  }

  return Object.values(map)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

/**
 * Filters a list of orders to those created within the last `months` months.
 */
export function filterByPeriod(orders, months) {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  cutoff.setDate(1);
  cutoff.setHours(0, 0, 0, 0);
  return orders.filter((o) => new Date(o.created_at) >= cutoff);
}

/**
 * Summarises an array of orders into { totalRevenue, totalOrders, avgTicket }.
 */
export function summariseOrders(orders) {
  const totalRevenue = orders.reduce((s, o) => s + (o.total ?? 0), 0);
  const totalOrders = orders.length;
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  return { totalRevenue, totalOrders, avgTicket };
}