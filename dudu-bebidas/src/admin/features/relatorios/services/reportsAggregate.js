// ── Aggregation helpers (pure, safe to unit-test) ─────────────────────────────

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
