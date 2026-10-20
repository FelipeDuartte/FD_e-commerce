// Cálculos das abas novas do relatório (margens, estoque, produtos,
// delivery, horários). Funções puras — recebem as linhas já buscadas e
// devolvem números prontos pra tela.

import { netRevenue, periodCutoff } from "./reportsAggregate";

const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (v) => Math.round(v * 100) / 100;

function groupBy(list, keyFn) {
  const map = new Map();
  for (const item of list) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

// ── Custo ────────────────────────────────────────────────────────────────

/**
 * Custo unitário de um produto numa data: o da última compra registrada
 * ANTES da venda (o produto só guarda o custo mais recente, que mudaria a
 * margem de vendas antigas toda vez que o preço do fornecedor muda). Sem
 * compra anterior, usa o custo atual. Fardo sem custo próprio usa o custo
 * do produto base × unidades do fardo. null = sem custo conhecido.
 */
export function buildCostResolver(products, stockEntries) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const purchases = new Map();
  for (const e of stockEntries) {
    if (e.reason !== "compra" || e.unit_cost == null) continue;
    if (!purchases.has(e.product_id)) purchases.set(e.product_id, []);
    purchases.get(e.product_id).push({ t: Date.parse(e.created_at), cost: Number(e.unit_cost) });
  }
  for (const list of purchases.values()) list.sort((a, b) => a.t - b.t);

  const ownCost = (id, t) => {
    let found = null;
    for (const p of purchases.get(id) ?? []) {
      if (p.t > t) break;
      found = p.cost;
    }
    if (found != null) return found;
    const product = byId.get(id);
    return product?.cost_price != null ? Number(product.cost_price) : null;
  };

  return (productId, at) => {
    const t = Date.parse(at);
    const own = ownCost(productId, t);
    if (own != null) return own;
    const product = byId.get(productId);
    if (product?.pack_of_product_id && product.pack_units) {
      const base = ownCost(product.pack_of_product_id, t);
      if (base != null) return base * product.pack_units;
    }
    return null;
  };
}

/**
 * Linhas de item já com receita líquida (desconto do pedido rateado pelo
 * peso de cada item) e custo da época. Base de margem, curva ABC e
 * categorias.
 */
export function buildSaleLines(orders, items, costAt) {
  const ordersById = new Map(orders.map((o) => [o.id, o]));
  const itemsByOrder = groupBy(items, (i) => i.order_id);
  const lines = [];

  for (const [orderId, orderItems] of itemsByOrder) {
    const order = ordersById.get(orderId);
    if (!order) continue;
    const gross = orderItems.reduce((s, i) => s + Number(i.price ?? 0) * (i.quantity ?? 0), 0);
    const discountRatio = gross > 0 ? Math.min(Number(order.discount_amount ?? 0) / gross, 1) : 0;

    for (const i of orderItems) {
      const quantity = i.quantity ?? 0;
      if (quantity <= 0) continue;
      const revenue = Number(i.price ?? 0) * quantity * (1 - discountRatio);
      const unitCost = i.product_id ? costAt(i.product_id, order.created_at) : null;
      lines.push({
        orderId,
        productId: i.product_id,
        name: i.name,
        quantity,
        revenue,
        cost: unitCost != null ? unitCost * quantity : null,
        createdAt: order.created_at,
        channel: order.channel,
      });
    }
  }
  return lines;
}

// ── Margens ──────────────────────────────────────────────────────────────

export const LOW_MARGIN_PCT = 20;

export function aggregateMargins(lines, products) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const perProduct = new Map();
  let noCostRevenue = 0;

  for (const l of lines) {
    const key = l.productId ?? l.name;
    if (!perProduct.has(key)) {
      perProduct.set(key, {
        productId: l.productId,
        name: byId.get(l.productId)?.name ?? l.name,
        category: byId.get(l.productId)?.category ?? "—",
        quantity: 0, revenue: 0, cost: 0, missingCost: false,
      });
    }
    const row = perProduct.get(key);
    row.quantity += l.quantity;
    row.revenue += l.revenue;
    if (l.cost == null) {
      row.missingCost = true;
      noCostRevenue += l.revenue;
    } else {
      row.cost += l.cost;
    }
  }

  const rows = [...perProduct.values()].map((r) => {
    const profit = r.missingCost ? null : r.revenue - r.cost;
    return { ...r, profit, marginPct: profit != null && r.revenue > 0 ? (profit / r.revenue) * 100 : null };
  });

  const costed = rows.filter((r) => !r.missingCost);
  const revenue = costed.reduce((s, r) => s + r.revenue, 0);
  const cost = costed.reduce((s, r) => s + r.cost, 0);

  const byCategory = new Map();
  for (const r of costed) {
    if (!byCategory.has(r.category)) byCategory.set(r.category, { category: r.category, revenue: 0, cost: 0 });
    const c = byCategory.get(r.category);
    c.revenue += r.revenue;
    c.cost += r.cost;
  }

  return {
    rows: rows.sort((a, b) => (b.profit ?? -Infinity) - (a.profit ?? -Infinity)),
    totals: { revenue, cost, profit: revenue - cost, marginPct: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0 },
    noCostRevenue,
    missingCost: rows.filter((r) => r.missingCost).sort((a, b) => b.revenue - a.revenue),
    belowCost: costed.filter((r) => r.profit < -0.004).sort((a, b) => a.profit - b.profit),
    lowMargin: costed
      .filter((r) => r.profit >= -0.004 && r.marginPct != null && r.marginPct < LOW_MARGIN_PCT)
      .sort((a, b) => a.marginPct - b.marginPct),
    byCategory: [...byCategory.values()]
      .map((c) => ({ ...c, profit: c.revenue - c.cost, marginPct: c.revenue > 0 ? ((c.revenue - c.cost) / c.revenue) * 100 : 0 }))
      .sort((a, b) => b.profit - a.profit),
  };
}

/**
 * Caixa do período: dinheiro que entrou (vendas recebidas + fiado recebido)
 * menos contas pagas. Não subtrai custo dos produtos de novo — a compra de
 * mercadoria normalmente já está nas contas pagas (boleto do fornecedor).
 */
export function aggregateCashResult(revenueRows, bills, stockEntries, period) {
  const cutoff = periodCutoff(period);
  const received = revenueRows.reduce((s, o) => s + netRevenue(o), 0);
  const paidBills = bills.filter((b) => new Date(`${b.paid_at}T12:00:00`) >= cutoff);
  const paid = paidBills.reduce((s, b) => s + Number(b.amount_paid ?? b.amount ?? 0), 0);

  const billsByCategory = new Map();
  for (const b of paidBills) {
    const key = b.category?.trim() || "Sem categoria";
    billsByCategory.set(key, (billsByCategory.get(key) ?? 0) + Number(b.amount_paid ?? b.amount ?? 0));
  }

  const bonuses = stockEntries.filter((e) => e.reason === "bonificacao" && new Date(e.created_at) >= cutoff);

  return {
    received,
    paid,
    balance: received - paid,
    billsByCategory: [...billsByCategory.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    bonusUnits: bonuses.reduce((s, e) => s + (e.quantity ?? 0), 0),
    bonusValue: bonuses.reduce((s, e) => s + Number(e.bonus_value ?? 0), 0),
  };
}

// ── Produtos ─────────────────────────────────────────────────────────────

export function aggregateByCategory(lines, products) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const map = new Map();
  for (const l of lines) {
    const category = byId.get(l.productId)?.category ?? "—";
    if (!map.has(category)) map.set(category, { category, quantity: 0, revenue: 0 });
    const c = map.get(category);
    c.quantity += l.quantity;
    c.revenue += l.revenue;
  }
  const total = [...map.values()].reduce((s, c) => s + c.revenue, 0);
  return [...map.values()]
    .map((c) => ({ ...c, pct: total > 0 ? (c.revenue / total) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue);
}

/** Curva ABC por faturamento: A até 80% acumulado, B até 95%, C o resto. */
export function aggregateAbc(lines, products) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const map = new Map();
  for (const l of lines) {
    const key = l.productId ?? l.name;
    if (!map.has(key)) map.set(key, { name: byId.get(l.productId)?.name ?? l.name, quantity: 0, revenue: 0 });
    const r = map.get(key);
    r.quantity += l.quantity;
    r.revenue += l.revenue;
  }
  const rows = [...map.values()].sort((a, b) => b.revenue - a.revenue);
  const total = rows.reduce((s, r) => s + r.revenue, 0);
  let acc = 0;
  const classified = rows.map((r) => {
    const startPct = total > 0 ? (acc / total) * 100 : 0;
    acc += r.revenue;
    const cls = startPct < 80 ? "A" : startPct < 95 ? "B" : "C";
    return { ...r, pct: total > 0 ? (r.revenue / total) * 100 : 0, cumulativePct: total > 0 ? (acc / total) * 100 : 0, cls };
  });
  const summary = ["A", "B", "C"].map((cls) => {
    const group = classified.filter((r) => r.cls === cls);
    return {
      cls,
      count: group.length,
      revenue: group.reduce((s, r) => s + r.revenue, 0),
      pct: total > 0 ? (group.reduce((s, r) => s + r.revenue, 0) / total) * 100 : 0,
    };
  });
  return { rows: classified, summary };
}

/**
 * Fardo × unidade: pra cada produto que tem fardo/caixa, quanto saiu
 * avulso e quanto saiu dentro de fardo, e o preço médio por unidade em
 * cada forma (mostra se o desconto do fardo está fazendo sentido).
 */
export function aggregatePackVsUnit(lines, products) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const map = new Map();
  const ensure = (base) => {
    if (!map.has(base.id)) {
      map.set(base.id, {
        name: base.name, unitQty: 0, unitRevenue: 0, packUnits: 0, packQty: 0, packRevenue: 0, packs: new Set(),
      });
    }
    return map.get(base.id);
  };

  for (const p of products) {
    if (p.pack_of_product_id && byId.get(p.pack_of_product_id)) ensure(byId.get(p.pack_of_product_id)).packs.add(p.name);
  }

  for (const l of lines) {
    const product = byId.get(l.productId);
    if (!product) continue;
    if (product.pack_of_product_id && product.pack_units) {
      const base = byId.get(product.pack_of_product_id);
      if (!base) continue;
      const row = ensure(base);
      row.packQty += l.quantity;
      row.packUnits += l.quantity * product.pack_units;
      row.packRevenue += l.revenue;
    } else if (map.has(product.id)) {
      const row = map.get(product.id);
      row.unitQty += l.quantity;
      row.unitRevenue += l.revenue;
    }
  }

  return [...map.values()]
    .filter((r) => r.unitQty > 0 || r.packQty > 0)
    .map((r) => {
      const totalUnits = r.unitQty + r.packUnits;
      return {
        name: r.name,
        packNames: [...r.packs].join(", "),
        unitQty: r.unitQty,
        packQty: r.packQty,
        packUnits: r.packUnits,
        packSharePct: totalUnits > 0 ? (r.packUnits / totalUnits) * 100 : 0,
        unitPrice: r.unitQty > 0 ? r.unitRevenue / r.unitQty : null,
        packUnitPrice: r.packUnits > 0 ? r.packRevenue / r.packUnits : null,
      };
    })
    .sort((a, b) => b.unitQty + b.packUnits - (a.unitQty + a.packUnits));
}

// ── Estoque ──────────────────────────────────────────────────────────────

/** Unidades do produto base vendidas por dia — fardo conta como N unidades. */
function baseUnitsSold(lines, products, sinceMs) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const sold = new Map();
  const lastSale = new Map();
  for (const l of lines) {
    const product = byId.get(l.productId);
    if (!product) continue;
    const isPack = product.pack_of_product_id && product.pack_units;
    const baseId = isPack ? product.pack_of_product_id : product.id;
    const units = isPack ? l.quantity * product.pack_units : l.quantity;
    const t = Date.parse(l.createdAt);
    if (t >= sinceMs) sold.set(baseId, (sold.get(baseId) ?? 0) + units);
    if (t > (lastSale.get(baseId) ?? 0)) lastSale.set(baseId, t);
  }
  return { sold, lastSale };
}

export const FORECAST_WINDOW_DAYS = 30;

/**
 * Previsão de falta: média diária de venda nos últimos 30 dias (todos os
 * canais) → em quantos dias o estoque acaba, e quanto comprar pra cobrir
 * `coverDays`. Sugestão também em fardos quando o produto tem fardo.
 */
export function forecastStock(lines, products, coverDays, now = Date.now()) {
  const { sold } = baseUnitsSold(lines, products, now - FORECAST_WINDOW_DAYS * DAY_MS);
  const packsByBase = groupBy(products.filter((p) => p.pack_of_product_id && p.pack_units), (p) => p.pack_of_product_id);

  return products
    .filter((p) => !p.pack_of_product_id && sold.get(p.id) > 0)
    .map((p) => {
      const avgDaily = sold.get(p.id) / FORECAST_WINDOW_DAYS;
      const stock = Math.max(p.stock ?? 0, 0);
      const daysLeft = avgDaily > 0 ? stock / avgDaily : Infinity;
      const toBuy = Math.max(Math.ceil(avgDaily * coverDays - stock), 0);
      const pack = (packsByBase.get(p.id) ?? []).sort((a, b) => b.pack_units - a.pack_units)[0];
      return {
        id: p.id,
        name: p.name,
        stock,
        avgDaily,
        daysLeft,
        toBuy,
        packSuggestion: pack && toBuy > 0 ? { name: pack.name, packs: Math.ceil(toBuy / pack.pack_units), units: pack.pack_units } : null,
        status: stock <= 0 ? "acabou" : daysLeft <= 3 ? "critico" : daysLeft <= 7 ? "atencao" : "ok",
      };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/** Produtos com estoque e sem venda há `idleDays` dias — dinheiro parado. */
export function findIdleProducts(lines, products, idleDays, now = Date.now()) {
  const { lastSale } = baseUnitsSold(lines, products, 0);
  const limit = now - idleDays * DAY_MS;
  return products
    .filter((p) => !p.pack_of_product_id && (p.stock ?? 0) > 0)
    .filter((p) => (lastSale.get(p.id) ?? 0) < limit)
    .map((p) => {
      const last = lastSale.get(p.id);
      const cost = p.cost_price != null ? Number(p.cost_price) : null;
      return {
        id: p.id,
        name: p.name,
        stock: p.stock,
        lastSaleAt: last ? new Date(last).toISOString() : null,
        daysIdle: last ? Math.floor((now - last) / DAY_MS) : null,
        capital: cost != null ? cost * p.stock : null,
      };
    })
    .sort((a, b) => (b.capital ?? -1) - (a.capital ?? -1));
}

// ── Delivery ─────────────────────────────────────────────────────────────

/** "entrega" (site), "retirada" (site), "entrega_balcao" ou null (venda no balcão). */
export function deliveryKind(order) {
  if (order.channel === "online") return order.address?.isRetirada ? "retirada" : "entrega";
  return order.address?.street ? "entrega_balcao" : null;
}

function districtOf(order) {
  const raw = (order.address?.district || order.address?.bairro || "").trim();
  return raw || "Sem bairro";
}

/** Taxa de entrega não fica gravada à parte: total − itens + desconto − taxa do cartão. */
export function deliveryFeeOf(order, orderItems) {
  if (order.channel !== "online") return 0;
  const itemsTotal = orderItems.reduce((s, i) => s + Number(i.price ?? 0) * (i.quantity ?? 0), 0);
  const fee = round2(Number(order.total ?? 0) - Number(order.card_fee_amount ?? 0) + Number(order.discount_amount ?? 0) - itemsTotal);
  return fee > 0.009 ? fee : 0;
}

export function aggregateDelivery(orders, items, lostOrders) {
  const itemsByOrder = groupBy(items, (i) => i.order_id);
  const deliveries = [];
  let pickups = 0;

  for (const o of orders) {
    const kind = deliveryKind(o);
    if (kind === "retirada") pickups += 1;
    if (kind !== "entrega" && kind !== "entrega_balcao") continue;
    deliveries.push({ order: o, kind, fee: deliveryFeeOf(o, itemsByOrder.get(o.id) ?? []), revenue: netRevenue(o) });
  }

  const revenue = deliveries.reduce((s, d) => s + d.revenue, 0);
  const fees = deliveries.reduce((s, d) => s + d.fee, 0);

  const byDistrict = new Map();
  for (const d of deliveries) {
    const name = districtOf(d.order);
    const key = name.toLowerCase();
    if (!byDistrict.has(key)) byDistrict.set(key, { district: name, count: 0, revenue: 0, fees: 0 });
    const row = byDistrict.get(key);
    row.count += 1;
    row.revenue += d.revenue;
    row.fees += d.fee;
  }

  const byCourier = new Map();
  for (const d of deliveries) {
    const name = d.order.courier_name?.trim() || (d.kind === "entrega_balcao" ? "Entrega do balcão" : "Sem entregador");
    if (!byCourier.has(name)) byCourier.set(name, { courier: name, count: 0, revenue: 0 });
    const row = byCourier.get(name);
    row.count += 1;
    row.revenue += d.revenue;
  }

  const dispatchMinutes = deliveries
    .filter((d) => d.order.on_the_way_at)
    .map((d) => (Date.parse(d.order.on_the_way_at) - Date.parse(d.order.created_at)) / 60000)
    .filter((m) => m >= 0)
    .sort((a, b) => a - b);

  const onlineDelivered = orders.filter((o) => o.channel === "online").length;
  const rejected = lostOrders.filter((o) => o.status === "rejected");
  const cancelled = lostOrders.filter((o) => o.status === "cancelled");

  return {
    count: deliveries.length,
    revenue,
    avgTicket: deliveries.length ? revenue / deliveries.length : 0,
    fees,
    pickups,
    fromCounter: deliveries.filter((d) => d.kind === "entrega_balcao").length,
    byDistrict: [...byDistrict.values()]
      .map((r) => ({ ...r, avgTicket: r.revenue / r.count }))
      .sort((a, b) => b.count - a.count || b.revenue - a.revenue),
    byCourier: [...byCourier.values()].sort((a, b) => b.count - a.count),
    dispatch: dispatchMinutes.length
      ? {
          count: dispatchMinutes.length,
          avg: dispatchMinutes.reduce((s, m) => s + m, 0) / dispatchMinutes.length,
          median: dispatchMinutes[Math.floor(dispatchMinutes.length / 2)],
          under30Pct: (dispatchMinutes.filter((m) => m <= 30).length / dispatchMinutes.length) * 100,
        }
      : null,
    lost: {
      rejected: rejected.length,
      cancelled: cancelled.length,
      value: lostOrders.reduce((s, o) => s + Number(o.total ?? 0), 0),
      ratePct: onlineDelivered + lostOrders.length > 0 ? (lostOrders.length / (onlineDelivered + lostOrders.length)) * 100 : 0,
    },
    orders: deliveries.map((d) => d.order),
  };
}

// ── Horários de pico ─────────────────────────────────────────────────────

export const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Grade dia da semana × hora com nº de vendas e faturamento (horário local). */
export function aggregatePeakHours(orders) {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ count: 0, revenue: 0 })));
  for (const o of orders) {
    const d = new Date(o.created_at);
    const cell = grid[d.getDay()][d.getHours()];
    cell.count += 1;
    cell.revenue += netRevenue(o);
  }
  let max = 0;
  let best = null;
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const c = grid[day][hour].count;
      if (c > max) {
        max = c;
        best = { day, hour };
      }
    }
  }
  const byDay = grid.map((hours, day) => ({ day, count: hours.reduce((s, h) => s + h.count, 0) }));
  const usedHours = [];
  for (let hour = 0; hour < 24; hour++) {
    if (grid.some((hours) => hours[hour].count > 0)) usedHours.push(hour);
  }
  return {
    grid,
    max,
    best,
    bestDay: byDay.reduce((a, b) => (b.count > a.count ? b : a), byDay[0]),
    hours: usedHours.length ? range(Math.min(...usedHours), Math.max(...usedHours)) : [],
  };
}

function range(from, to) {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
