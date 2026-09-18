// ── Aggregation helpers (pure, safe to unit-test) ─────────────────────────────

// Taxa da maquininha (crédito parcelado) não é faturamento de produto — é só
// repasse de custo. Todo cálculo de "quanto vendi"/"quanto o cliente gastou"
// usa isso em vez de order.total puro. aggregatePaymentBreakdown é a exceção
// de propósito (ali o que importa é quanto dinheiro entrou por forma, taxa
// incluída — não é métrica de faturamento).
function netRevenue(order) {
  return (order.total ?? 0) - (order.card_fee_amount ?? 0);
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
      buckets[key].revenue += netRevenue(order);
      if (!order.isReceipt) buckets[key].count += 1;
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
    map[key].total += netRevenue(order);
    map[key].count += 1;
  }

  return Object.values(map)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

/**
 * Filtra pedidos por período — { unit: "days", amount: N } é uma janela
 * corrida (ex: "última semana" = hoje - 7 dias); { unit: "months", amount: N }
 * corta no dia 1 do mês N meses atrás (comportamento original, alinhado ao
 * calendário).
 */
export function filterByPeriod(orders, period) {
  const cutoff = new Date();
  if (period.unit === "days") {
    cutoff.setDate(cutoff.getDate() - period.amount);
  } else {
    cutoff.setMonth(cutoff.getMonth() - period.amount);
    cutoff.setDate(1);
  }
  cutoff.setHours(0, 0, 0, 0);
  return orders.filter((o) => new Date(o.created_at) >= cutoff);
}

/**
 * Summarises an array of orders into { totalRevenue, totalOrders, avgTicket }.
 */
export function summariseOrders(orders) {
  const totalRevenue = orders.reduce((s, o) => s + netRevenue(o), 0);
  // Recebimento de fiado é dinheiro que entrou, não uma venda — fica fora
  // da contagem de pedidos e do ticket médio.
  const realOrders = orders.filter((o) => !o.isReceipt);
  const totalOrders = realOrders.length;
  const avgTicket = totalOrders > 0 ? realOrders.reduce((s, o) => s + netRevenue(o), 0) / totalOrders : 0;
  return { totalRevenue, totalOrders, avgTicket };
}

/**
 * Quebra o faturamento por forma de pagamento — ciente de venda dividida
 * ("misto"): pedido normal soma o próprio total no bucket do seu
 * payment_method; pedido misto é explodido pelas linhas de order_payments
 * (a parte em dinheiro cai em "cash", a parte no cartão em "credit_card"
 * etc — mesma lógica de close_cash_session, só que por período em vez de
 * por sessão de caixa). Venda fiado não entra aqui (ainda não foi recebida);
 * o pagamento do cliente entra pela forma com que ele pagou.
 */
export function aggregatePaymentBreakdown(orders, payments) {
  const paymentsByOrder = {};
  for (const p of payments) {
    (paymentsByOrder[p.order_id] ??= []).push(p);
  }

  const map = {};
  for (const order of orders) {
    if (order.payment_method === "misto") {
      const lines = paymentsByOrder[order.id] ?? [];
      for (const line of lines) {
        map[line.method] = (map[line.method] ?? 0) + Number(line.amount ?? 0);
      }
    } else {
      const method = order.payment_method ?? "outro";
      map[method] = (map[method] ?? 0) + (order.total ?? 0);
    }
  }

  const total = Object.values(map).reduce((s, v) => s + v, 0);
  return Object.entries(map)
    .map(([method, amount]) => ({
      method,
      amount,
      pct: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/** Soma faturamento por canal (site vs balcão) — só relevante no recorte combinado. */
export function aggregateChannelSplit(orders) {
  const result = { online: 0, balcao: 0 };
  for (const order of orders) {
    if (order.channel === "balcao") result.balcao += netRevenue(order);
    else result.online += netRevenue(order);
  }
  return result;
}
