import { supabase } from "../../../shared/supabase/Supabaseclient";
import { AdminServiceError } from "../../../shared/services/AdminServiceError";

// O Supabase devolve no máximo 1000 linhas por request.
const REPORTS_PAGE_SIZE = 1000;
// Quantas páginas buscar ao mesmo tempo depois da primeira.
const PARALLEL_PAGES = 4;

/** ISO string for the 1st of the month, N months ago */
function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Busca paginada: a primeira página já traz o total de linhas, e as
 * demais são buscadas em paralelo (de 4 em 4) em vez de uma por vez.
 * Ordena também por id pra paginação estável (duas linhas com o mesmo
 * created_at nunca trocam de página entre um request e outro).
 */
async function fetchAllPages({ table, columns, apply, errorMessage }) {
  const page = (from, withCount = false) =>
    apply(supabase.from(table).select(columns, withCount ? { count: "exact" } : undefined))
      .order("id", { ascending: true })
      .range(from, from + REPORTS_PAGE_SIZE - 1);

  const first = await page(0, true);
  if (first.error) throw new AdminServiceError(errorMessage, first.error);
  const rows = [...(first.data ?? [])];
  const total = first.count ?? rows.length;

  const offsets = [];
  for (let from = REPORTS_PAGE_SIZE; from < total; from += REPORTS_PAGE_SIZE) offsets.push(from);

  for (let i = 0; i < offsets.length; i += PARALLEL_PAGES) {
    const results = await Promise.all(offsets.slice(i, i + PARALLEL_PAGES).map((from) => page(from)));
    for (const r of results) {
      if (r.error) throw new AdminServiceError(errorMessage, r.error);
      rows.push(...(r.data ?? []));
    }
  }
  return rows;
}

/**
 * Todas as vendas concluídas (delivered) dos últimos 12 meses, site +
 * balcão — o filtro de canal é aplicado na tela, sem nova busca.
 * Itens e pagamentos divididos vêm JUNTO de cada pedido (uma consulta só),
 * em vez de buscados depois em blocos de 500 pedidos, um bloco por vez.
 * Inclui fiado: o produto saiu da loja (conta pra margem, curva ABC,
 * previsão de estoque), mas o dinheiro só entra no faturamento quando o
 * cliente paga (ver fetchFiadoReceiptsForReports).
 */
export async function fetchSalesForReports() {
  const cutoff = monthsAgo(12);
  const rows = await fetchAllPages({
    table: "orders",
    columns:
      "id, total, discount_amount, card_fee_amount, payment_method, channel, created_at, address, on_the_way_at, courier_name, " +
      "order_items(product_id, name, quantity, price), order_payments(method, amount)",
    // Só pedido concluído — em aberto ainda não virou venda, e
    // rejeitado/cancelado nunca vira.
    apply: (q) => q.gte("created_at", cutoff).eq("status", "delivered").order("created_at", { ascending: true }),
    errorMessage: "Não foi possível carregar dados para relatórios.",
  });

  const orders = [];
  const items = [];
  const payments = [];
  for (const { order_items: orderItems, order_payments: orderPayments, ...order } of rows) {
    orders.push(order);
    for (const i of orderItems ?? []) items.push({ ...i, order_id: order.id });
    for (const p of orderPayments ?? []) payments.push({ ...p, order_id: order.id });
  }
  return { orders, items, payments };
}

/**
 * Pagamentos de fiado recebidos nos últimos 12 meses, já no formato de
 * "linha de faturamento" (mesmo shape de um pedido, com isReceipt=true) —
 * assim entram em faturamento, gráfico mensal e quebra por forma de
 * pagamento pelo dia em que o dinheiro entrou, sem contar como pedido.
 */
export async function fetchFiadoReceiptsForReports() {
  const cutoff = monthsAgo(12);
  const rows = await fetchAllPages({
    table: "pdv_customer_payments",
    columns: "id, amount, payment_method, created_at",
    apply: (q) => q.gte("created_at", cutoff).order("created_at", { ascending: true }),
    errorMessage: "Não foi possível carregar os recebimentos de fiado.",
  });
  return rows.map((r) => ({
    id: `fiado-pay-${r.id}`,
    total: Number(r.amount),
    card_fee_amount: 0,
    payment_method: r.payment_method,
    channel: "balcao",
    created_at: r.created_at,
    address: null,
    isReceipt: true,
  }));
}

/** Pedidos do site recusados/cancelados — taxa de perda no relatório de delivery. */
export function fetchLostOnlineOrdersForReports() {
  const cutoff = monthsAgo(12);
  return fetchAllPages({
    table: "orders",
    columns: "id, status, total, created_at, address",
    apply: (q) =>
      q.gte("created_at", cutoff).eq("channel", "online").in("status", ["rejected", "cancelled"])
        .order("created_at", { ascending: true }),
    errorMessage: "Não foi possível carregar os pedidos recusados.",
  });
}

/**
 * Entradas de estoque (compras com custo + bonificações), de todo o
 * histórico — o custo de uma venda é o da última compra ANTES dela, então
 * precisa de compras anteriores à janela de 12 meses também.
 */
export function fetchStockEntriesForReports() {
  return fetchAllPages({
    table: "stock_movements",
    columns: "id, product_id, quantity, unit_cost, bonus_value, reason, created_at",
    apply: (q) => q.in("reason", ["compra", "bonificacao"]).order("created_at", { ascending: true }),
    errorMessage: "Não foi possível carregar as compras de estoque.",
  });
}

/** Contas pagas nos últimos 12 meses — saída de caixa no resultado do período. */
export function fetchPaidBillsForReports() {
  const cutoff = monthsAgo(12).slice(0, 10);
  return fetchAllPages({
    table: "accounts_payable",
    columns: "id, amount, amount_paid, paid_at, category",
    apply: (q) => q.not("paid_at", "is", null).gte("paid_at", cutoff).order("paid_at", { ascending: true }),
    errorMessage: "Não foi possível carregar as contas pagas.",
  });
}
