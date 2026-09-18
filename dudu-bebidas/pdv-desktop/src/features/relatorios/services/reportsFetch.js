import { supabase } from "../../../shared/supabase/Supabaseclient";
import { AdminServiceError } from "../../../shared/services/AdminServiceError";

// Máximo de linhas que o Supabase retorna por request — usado para paginar
// pedidos, itens e pagamentos divididos (evita truncar dados silenciosamente
// em lojas com muito volume).
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
 * `channel` opcional ("balcao") filtra só venda de balcão — sem ele, traz
 * site + balcão juntos (mesma fonte do relatório do admin web).
 */
export async function fetchOrdersForReports({ channel } = {}) {
  const cutoff = monthsAgo(12);
  const allOrders = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("orders")
      .select("id, total, discount_amount, card_fee_amount, payment_method, channel, created_at, address")
      .gte("created_at", cutoff)
      // Só conta pedido já recebido (delivered) — em aberto ainda não virou
      // dinheiro, e rejeitado/cancelado nunca vira.
      .eq("status", "delivered")
      // Fiado ainda não é dinheiro recebido — entra no relatório só quando o
      // cliente paga (ver fetchFiadoReceiptsForReports).
      .neq("payment_method", "fiado")
      .order("created_at", { ascending: true })
      .range(from, from + REPORTS_PAGE_SIZE - 1);

    if (channel) query = query.eq("channel", channel);

    const { data, error } = await query;

    if (error) {
      throw new AdminServiceError(
        "Não foi possível carregar dados para relatórios.",
        error,
      );
    }

    const rows = data ?? [];
    allOrders.push(...rows);

    if (rows.length < REPORTS_PAGE_SIZE) break;
    from += REPORTS_PAGE_SIZE;
  }

  return allOrders;
}

/**
 * Fetches ALL order_items for the given order IDs with automatic pagination.
 * Chunka os IDs de 500 em 500 (limite seguro pro filtro `.in()`), e cada
 * chunk é paginado por conta própria.
 */
export async function fetchOrderItemsForReports(orderIds) {
  if (!orderIds.length) return [];

  const ID_CHUNK = 500;
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

/**
 * Fetches order_payments (detalhamento de venda dividida/"misto") para os
 * IDs informados — o chamador já filtra pra só mandar pedidos misto, não
 * a lista inteira, mas a função é segura de qualquer forma.
 */
export async function fetchOrderPaymentsForReports(orderIds) {
  if (!orderIds.length) return [];

  const ID_CHUNK = 500;
  const idChunks = [];
  for (let i = 0; i < orderIds.length; i += ID_CHUNK) {
    idChunks.push(orderIds.slice(i, i + ID_CHUNK));
  }

  const allPayments = [];

  for (const ids of idChunks) {
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("order_payments")
        .select("order_id, method, amount")
        .in("order_id", ids)
        .range(from, from + REPORTS_PAGE_SIZE - 1);

      if (error) {
        throw new AdminServiceError(
          "Não foi possível carregar o detalhamento de pagamentos divididos.",
          error,
        );
      }

      const rows = data ?? [];
      allPayments.push(...rows);

      if (rows.length < REPORTS_PAGE_SIZE) break;
      from += REPORTS_PAGE_SIZE;
    }
  }

  return allPayments;
}

/**
 * Pagamentos de fiado recebidos nos últimos 12 meses, já no formato de
 * "linha de faturamento" (mesmo shape de um pedido, com isReceipt=true) —
 * assim entram em faturamento, gráfico mensal e quebra por forma de
 * pagamento pelo dia em que o dinheiro entrou, sem contar como pedido.
 */
export async function fetchFiadoReceiptsForReports() {
  const cutoff = monthsAgo(12);
  const receipts = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("pdv_customer_payments")
      .select("id, amount, payment_method, created_at")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: true })
      .range(from, from + REPORTS_PAGE_SIZE - 1);

    if (error) {
      throw new AdminServiceError("Não foi possível carregar os recebimentos de fiado.", error);
    }

    const rows = data ?? [];
    for (const r of rows) {
      receipts.push({
        id: `fiado-pay-${r.id}`,
        total: Number(r.amount),
        card_fee_amount: 0,
        payment_method: r.payment_method,
        channel: "balcao",
        created_at: r.created_at,
        address: null,
        isReceipt: true,
      });
    }
    if (rows.length < REPORTS_PAGE_SIZE) break;
    from += REPORTS_PAGE_SIZE;
  }

  return receipts;
}
