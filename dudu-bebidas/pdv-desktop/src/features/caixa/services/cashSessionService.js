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
