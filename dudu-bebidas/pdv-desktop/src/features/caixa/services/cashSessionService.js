import { supabase, getCurrentStoreId } from "../../../shared/supabase/Supabaseclient";
import { AdminServiceError } from "../../../shared/services/AdminServiceError";

async function getCurrentUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

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

const PAST_SESSIONS_LIMIT = 30;

/**
 * Caixas já fechados, mais recentes primeiro. Com `date` (AAAA-MM-DD),
 * traz os caixas abertos naquele dia — pra achar um dia antigo sem
 * precisar rolar a lista.
 */
export async function listPastCashSessions({ date } = {}) {
  let query = supabase
    .from("cash_sessions")
    .select("id, opened_at, closed_at, opening_amount, closing_amount_declared, closing_amount_expected, status, orders(count)")
    .eq("store_id", getCurrentStoreId())
    .eq("status", "closed")
    .order("opened_at", { ascending: false });

  if (date) {
    const start = new Date(`${date}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    query = query.gte("opened_at", start.toISOString()).lt("opened_at", end.toISOString());
  } else {
    query = query.limit(PAST_SESSIONS_LIMIT);
  }

  const { data, error } = await query;
  if (error) {
    throw new AdminServiceError("Não foi possível carregar os caixas anteriores.", error);
  }
  return (data ?? []).map((s) => ({
    id: s.id,
    openedAt: s.opened_at,
    closedAt: s.closed_at,
    openingAmount: Number(s.opening_amount ?? 0),
    declared: s.closing_amount_declared != null ? Number(s.closing_amount_declared) : null,
    expected: s.closing_amount_expected != null ? Number(s.closing_amount_expected) : null,
    orderCount: s.orders?.[0]?.count ?? 0,
  }));
}
