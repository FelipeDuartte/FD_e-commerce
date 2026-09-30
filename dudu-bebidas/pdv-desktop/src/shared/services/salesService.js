import { supabase, getCurrentStoreId } from "../supabase/Supabaseclient";
import { AdminServiceError } from "./AdminServiceError";

export async function createPdvSale({
  cartItems, paymentMethod, cashSessionId, discountAmount, payments, pdvCustomerId, installments,
  deferStockUntilPaid,
}) {
  const { data, error } = await supabase.functions.invoke("pdv-sale", {
    body: { cartItems, paymentMethod, cashSessionId, discountAmount, payments, pdvCustomerId, installments, deferStockUntilPaid },
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
    // Detalhamento real de quando payment_method === "misto" (pagamento
    // dividido) — sem isso, o histórico só mostrava "misto" sem dizer
    // quais formas de verdade compuseram a venda.
    payments: (o.order_payments ?? []).map((p) => ({ method: p.method, amount: p.amount })),
    installments: o.installments,
    cancelled: o.status === "cancelled",
    createdAt: o.created_at,
    cashSessionId: o.cash_session_id,
    itemCount: items.reduce((sum, it) => sum + it.quantity, 0),
    // Array (uma linha por item) — usado no Histórico e na notinha impressa
    // pra mostrar cada produto na própria linha, em vez de um texto corrido
    // cortado. itemsLabel continua existindo por compatibilidade (tooltip).
    items: items.map((it) => (it.quantity > 1 ? `${it.name} x${it.quantity}` : it.name)),
    itemsLabel: items
      .map((it) => (it.quantity > 1 ? `${it.name} x${it.quantity}` : it.name))
      .join(", "),
    // Item a item com id — usado só pra remover um item específico de um
    // pedido fiado (ver removeSaleItem), o resto da tela usa "items" acima.
    orderItems: items.map((it) => ({ id: it.id, name: it.name, quantity: it.quantity })),
  };
}

async function queryPdvSales({ sessionId, sinceDays, onlyCancelled, limit } = {}) {
  let query = supabase
    .from("orders")
    .select("id, order_number, total, discount_amount, payment_method, installments, status, created_at, cash_session_id, order_items(id, name, quantity), order_payments(method, amount)")
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

// Remove um item de um pedido fiado ("Em Aberto") sem cancelar o pedido
// inteiro — ver migration 0035 pras regras (só fiado, só caixa ainda aberto).
export async function removeSaleItem(orderId, orderItemId) {
  const { data, error } = await supabase.rpc("remove_pdv_sale_item", {
    p_order_id: orderId,
    p_order_item_id: orderItemId,
    p_store_id: getCurrentStoreId(),
  });

  if (error) {
    throw new AdminServiceError("Não foi possível remover o item.", error);
  }
  if (!data?.success) {
    throw new AdminServiceError(data?.error || "Não foi possível remover o item.");
  }
  return data;
}
