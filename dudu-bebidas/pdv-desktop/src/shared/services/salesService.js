import { supabase, getCurrentStoreId } from "../supabase/Supabaseclient";
import { AdminServiceError } from "./AdminServiceError";

export async function createPdvSale({ cartItems, paymentMethod, cashSessionId, discountAmount, payments, pdvCustomerId, installments }) {
  const { data, error } = await supabase.functions.invoke("pdv-sale", {
    body: { cartItems, paymentMethod, cashSessionId, discountAmount, payments, pdvCustomerId, installments },
  });

  if (error) {
    // supabase-js só devolve isso como um erro de transporte genérico — a
    // mensagem de verdade que a function respondeu (ex: "Cliente não
    // encontrado.") fica dentro de error.context (a Response crua). Sem
    // isso, todo erro de venda aparecia igual, mesmo sendo causas bem
    // diferentes.
    let detail = null;
    try {
      detail = (await error.context?.json())?.error ?? null;
    } catch {
      // corpo não era JSON (ex: 502/timeout) — segue sem detalhe.
    }
    console.error("[salesService] Erro ao registrar venda:", detail ?? error);
    throw new AdminServiceError(detail ?? "Não foi possível registrar a venda.", error);
  }
  if (data?.error) {
    throw new AdminServiceError(data.error);
  }
  return data;
}

function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function mapSaleRow(o) {
  const items = o.order_items ?? [];
  return {
    orderId: o.id,
    orderNumber: o.order_number,
    total: o.total,
    discountAmount: o.discount_amount,
    paymentMethod: o.payment_method,
    cancelled: o.status === "cancelled",
    createdAt: o.created_at,
    cashSessionId: o.cash_session_id,
    itemCount: items.reduce((sum, it) => sum + it.quantity, 0),
    itemsLabel: items
      .map((it) => (it.quantity > 1 ? `${it.name} x${it.quantity}` : it.name))
      .join(", "),
  };
}

async function queryPdvSales({ sessionId, sinceDays, onlyCancelled, limit } = {}) {
  let query = supabase
    .from("orders")
    .select("id, order_number, total, discount_amount, payment_method, status, created_at, cash_session_id, order_items(name, quantity)")
    .eq("channel", "balcao")
    .order("created_at", { ascending: false });

  if (sessionId) query = query.eq("cash_session_id", sessionId);
  if (sinceDays) query = query.gte("created_at", daysAgoISO(sinceDays));
  if (onlyCancelled) query = query.eq("status", "cancelled");
  if (limit) query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    throw new AdminServiceError("Não foi possível carregar as vendas.", error);
  }
  return (data ?? []).map(mapSaleRow);
}

export async function listSessionSales(sessionId) {
  return queryPdvSales({ sessionId });
}

// Últimos 7 dias, qualquer status — visão geral do que andou vendendo.
export async function listRecentSales() {
  return queryPdvSales({ sinceDays: 7 });
}

// Só canceladas, últimos 30 dias — bem menos volume que "recentes", então
// dá pra olhar mais pra trás sem virar uma consulta gigante.
export async function listCancelledSales() {
  return queryPdvSales({ sinceDays: 30, onlyCancelled: true });
}

// Sem corte de data, mas com limite de linhas — evita puxar o histórico
// inteiro de uma loja que já vende há anos.
export async function listFullHistorySales() {
  return queryPdvSales({ limit: 150 });
}

export async function cancelPdvSale(orderId) {
  const { data, error } = await supabase.rpc("cancel_pdv_sale", {
    p_order_id: orderId,
    p_store_id: getCurrentStoreId(),
  });

  if (error) {
    throw new AdminServiceError("Não foi possível cancelar a venda.", error);
  }
  if (!data?.success) {
    throw new AdminServiceError(data?.error || "Não foi possível cancelar a venda.");
  }
  return data;
}
