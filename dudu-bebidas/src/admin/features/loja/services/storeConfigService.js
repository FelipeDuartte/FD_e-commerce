import { supabase, getCurrentStoreId } from "../../../../shared/supabase/Supabaseclient";
import { AdminServiceError } from "../../../shared/services/AdminServiceError";

// Usado tanto por horarios/ (close_on_holidays) quanto por
// pagamentos/ (payment_methods_enabled) — os dois sub-features leem e
// gravam a mesma linha de store_config, por isso fica aqui em vez de
// dentro de um dos dois.

export async function getStoreConfig() {
  const { data, error } = await supabase
    .from("store_config")
    .select("*")
    .eq("store_id", getCurrentStoreId())
    .single();
  if (error)
    throw new AdminServiceError(
      "Não foi possível carregar as configurações.",
      error,
    );
  return data;
}

export async function updateStoreConfig(config) {
  const { error } = await supabase
    .from("store_config")
    .update({ ...config, updated_at: new Date().toISOString() })
    .eq("store_id", getCurrentStoreId());
  if (error)
    throw new AdminServiceError(
      "Não foi possível salvar as configurações.",
      error,
    );
}

export async function listStoreHours() {
  const { data, error } = await supabase
    .from("store_hours")
    .select("*")
    .order("day_of_week");
  if (error)
    throw new AdminServiceError(
      "Não foi possível carregar os horários.",
      error,
    );
  return data ?? [];
}

export async function upsertStoreHours(rows) {
  const storeId = getCurrentStoreId();
  for (const row of rows) {
    const toTime = (t) => (t && t.length === 5 ? `${t}:00` : (t ?? "09:00:00"));
    const { error } = await supabase
      .from("store_hours")
      .update({
        is_open: row.is_open,
        open_time: toTime(row.open_time),
        close_time: toTime(row.close_time),
      })
      .eq("store_id", storeId)
      .eq("day_of_week", row.day_of_week);
    if (error)
      throw new AdminServiceError(
        `Não foi possível salvar horário do dia ${row.day_of_week}.`,
        error,
      );
  }
}
