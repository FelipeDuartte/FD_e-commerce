import { supabase, getCurrentStoreId } from "../../../supabase/Supabaseclient";
import { AdminServiceError } from "./AdminServiceError";
import { getCurrentUserId } from "./adminTeamService";

// ── Sessão de caixa ────────────────────────────────────────────────────────

export async function getOpenCashSession() {
  const { data, error } = await supabase
    .from("cash_sessions")
    .select("*")
    .eq("store_id", getCurrentStoreId())
    .eq("status", "open")
    .maybeSingle();

  if (error) {
    throw new AdminServiceError("Não foi possível verificar o caixa.", error);
  }
  return data;
}

export async function openCashSession(openingAmount) {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("cash_sessions")
    .insert({
      store_id: getCurrentStoreId(),
      opened_by: userId,
      opening_amount: openingAmount,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new AdminServiceError("Já existe um caixa aberto nesta loja.");
    }
    throw new AdminServiceError("Não foi possível abrir o caixa.", error);
  }
  return data;
}

export async function closeCashSession(sessionId, declaredAmount) {
  const { data, error } = await supabase.rpc("close_cash_session", {
    p_session_id: sessionId,
    p_declared_amount: declaredAmount,
  });

  if (error) {
    throw new AdminServiceError("Não foi possível fechar o caixa.", error);
  }
  if (!data?.success) {
    throw new AdminServiceError(data?.error || "Não foi possível fechar o caixa.");
  }
  return data;
}

// ── Venda de balcão ─────────────────────────────────────────────────────────

export async function createPdvSale({ cartItems, paymentMethod, cashSessionId, discountAmount, payments }) {
  const { data, error } = await supabase.functions.invoke("pdv-sale", {
    body: { cartItems, paymentMethod, cashSessionId, discountAmount, payments },
  });

  if (error) {
    throw new AdminServiceError("Não foi possível registrar a venda.", error);
  }
  if (data?.error) {
    throw new AdminServiceError(data.error);
  }
  return data;
}

export async function listSessionSales(sessionId) {
  const { data, error } = await supabase
    .from("orders")
    .select("id, total, discount_amount, payment_method, status, created_at, order_items(name, quantity)")
    .eq("cash_session_id", sessionId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AdminServiceError("Não foi possível carregar as vendas da sessão.", error);
  }

  return (data ?? []).map((o) => {
    const items = o.order_items ?? [];
    return {
      orderId: o.id,
      total: o.total,
      discountAmount: o.discount_amount,
      paymentMethod: o.payment_method,
      cancelled: o.status === "cancelled",
      createdAt: o.created_at,
      itemCount: items.reduce((sum, it) => sum + it.quantity, 0),
      itemsLabel: items
        .map((it) => (it.quantity > 1 ? `${it.name} x${it.quantity}` : it.name))
        .join(", "),
    };
  });
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
