import { supabase, getCurrentStoreId } from "../../../supabase/Supabaseclient";
import { AdminServiceError } from "./AdminServiceError";

// Gestão de equipe (admins da loja atual). Promover/remover NUNCA mexe
// direto na tabela profiles pelo cliente — tudo passa pelas RPCs
// promote_store_admin / demote_store_admin (ver sql/08_admin_team_management.sql),
// que já garantem que só um admin promove/remove, e só dentro da própria loja.

export async function listTeam() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, created_at")
    .eq("store_id", getCurrentStoreId())
    .eq("is_admin", true)
    .order("created_at", { ascending: true });

  if (error) {
    throw new AdminServiceError("Não foi possível carregar a equipe.", error);
  }
  return data;
}

export async function promoteToAdmin(email) {
  const normalized = String(email).trim().toLowerCase();
  if (!normalized) throw new AdminServiceError("Informe um e-mail.");

  const { data, error } = await supabase.rpc("promote_store_admin", {
    p_target_email: normalized,
  });

  if (error) {
    throw new AdminServiceError("Não foi possível promover essa pessoa.", error);
  }
  if (!data?.success) {
    throw new AdminServiceError(data?.error || "Não foi possível promover essa pessoa.");
  }
  return data;
}

export async function demoteFromAdmin(userId) {
  const { data, error } = await supabase.rpc("demote_store_admin", {
    p_target_user_id: userId,
  });

  if (error) {
    throw new AdminServiceError("Não foi possível remover essa pessoa.", error);
  }
  if (!data?.success) {
    throw new AdminServiceError(data?.error || "Não foi possível remover essa pessoa.");
  }
  return data;
}

export async function getCurrentUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}