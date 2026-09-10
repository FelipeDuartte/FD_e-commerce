import { supabase, getCurrentStoreId } from "../../../shared/supabase/Supabaseclient";
import { AdminServiceError } from "../../../shared/services/AdminServiceError";

// Só essa coluna — o resto de store_config (frete grátis, horários etc.)
// é gerenciado em outras features, não precisa aqui.
export async function getCreditInstallmentFeeRate() {
  const { data, error } = await supabase
    .from("store_config")
    .select("credit_installment_fee_rate")
    .eq("store_id", getCurrentStoreId())
    .maybeSingle();

  if (error) {
    throw new AdminServiceError("Não foi possível carregar a taxa de crédito.", error);
  }
  return data?.credit_installment_fee_rate ?? null;
}
