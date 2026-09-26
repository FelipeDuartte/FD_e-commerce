import { supabase, getCurrentStoreId } from "../../../../../shared/supabase/Supabaseclient";
import { AdminServiceError } from "../../../../shared/services/AdminServiceError";

export async function listCouriers() {
  const { data, error } = await supabase
    .from("couriers")
    .select("id, name, phone, is_active, created_at")
    .eq("store_id", getCurrentStoreId())
    .order("created_at", { ascending: true });

  if (error) {
    throw new AdminServiceError("Não foi possível carregar os entregadores.", error);
  }
  return data;
}

// Usada no Painel de Pedidos (seletor de atribuição) — só quem tá
// trabalhando aparece pra escolher.
export async function listActiveCouriers() {
  const { data, error } = await supabase
    .from("couriers")
    .select("id, name, phone")
    .eq("store_id", getCurrentStoreId())
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new AdminServiceError("Não foi possível carregar os entregadores.", error);
  }
  return data;
}

export async function createCourier({ name, phone, email, password }) {
  const storeId = getCurrentStoreId();

  const { data, error } = await supabase.functions.invoke("create-courier", {
    body: { name, phone, email, password },
    headers: storeId ? { "x-store-id": storeId } : undefined,
  });

  if (error) {
    // supabase-js só preenche `data` quando a function responde 2xx — em
    // erro (4xx/5xx, ex: e-mail inválido/já usado, acesso negado) o corpo
    // JSON que a function mandou (com a mensagem real) fica só dentro de
    // error.context (a Response crua), não em `data`. Sem isso, toda
    // rejeição da function cai na mensagem genérica, escondendo o motivo.
    const body = await error.context?.json?.().catch(() => null);
    throw new AdminServiceError(body?.error || "Não foi possível cadastrar o entregador.", error);
  }
  if (data?.error) {
    throw new AdminServiceError(data.error);
  }
  return data.courier;
}

// Mapa geral do admin — posição de todo entregador que já compartilhou
// localização ao menos uma vez. RLS (courier_locations_admin_read) já
// garante que só vem entregador da própria loja.
export async function listCourierLocations() {
  const { data, error } = await supabase
    .from("courier_locations")
    .select("lat, lng, updated_at, couriers(name)");

  if (error) {
    throw new AdminServiceError("Não foi possível carregar a localização dos entregadores.", error);
  }
  return (data ?? []).map((row) => ({
    lat: row.lat,
    lng: row.lng,
    updatedAt: row.updated_at,
    name: row.couriers?.name ?? "Entregador",
  }));
}

export async function setCourierActive(courierId, isActive) {
  const { error } = await supabase
    .from("couriers")
    .update({ is_active: isActive })
    .eq("id", courierId);

  if (error) {
    throw new AdminServiceError("Não foi possível atualizar o entregador.", error);
  }
}
