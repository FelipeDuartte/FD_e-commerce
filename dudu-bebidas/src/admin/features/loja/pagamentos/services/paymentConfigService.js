import { supabase, getCurrentStoreId } from "../../../../../shared/supabase/Supabaseclient";
import { AdminServiceError } from "../../../../shared/services/AdminServiceError";

// ── InfinitePay ───────────────────────────────────────────────
// A chave da API (inchk_...) nunca volta pro navegador — só se já existe.
export async function getInfinitePayConfig() {
  const storeId = getCurrentStoreId();
  const { data, error } = await supabase
    .from("store_payment_configs")
    .select("infinitepay_handle")
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) {
    throw new AdminServiceError("Não foi possível carregar a configuração da InfinitePay.", error);
  }
  const { count } = await supabase
    .from("store_payment_configs")
    .select("store_id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .not("infinitepay_api_key", "is", null);

  return { handle: data?.infinitepay_handle ?? "", apiKeySet: (count ?? 0) > 0 };
}

/**
 * Salva a InfiniteTag (sem o $) e, só se digitada, a chave da API.
 * `disable: true` apaga as duas — o site volta pro Pix manual.
 */
export async function updateInfinitePayConfig({ handle, apiKey, disable = false }) {
  const payload = disable
    ? { infinitepay_handle: null, infinitepay_api_key: null }
    : { infinitepay_handle: String(handle ?? "").trim().replace(/^\$/, "") || null };
  if (!disable && apiKey?.trim()) payload.infinitepay_api_key = apiKey.trim();

  const { error } = await supabase
    .from("store_payment_configs")
    .upsert(
      { ...payload, store_id: getCurrentStoreId(), updated_at: new Date().toISOString() },
      { onConflict: "store_id" },
    );
  if (error) {
    throw new AdminServiceError("Não foi possível salvar a configuração da InfinitePay.", error);
  }
}
