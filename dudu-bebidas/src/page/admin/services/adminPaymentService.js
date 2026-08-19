import { supabase, getCurrentStoreId } from "../../../supabase/Supabaseclient";
import { AdminServiceError } from "./AdminServiceError";

export async function getPaymentConfig() {
  const { data, error } = await supabase
    .from("store_payment_configs")
    .select("*")
    .eq("store_id", getCurrentStoreId())
    .maybeSingle();

  if (error) {
    throw new AdminServiceError("Não foi possível carregar a configuração de pagamento.", error);
  }
  return data;
}

// Upsert em vez de update puro (diferente de updateStoreConfig): a loja
// pode não ter linha em store_payment_configs ainda — um update simples
// silenciosamente não faria nada nesse caso.
export async function updatePaymentConfig(config) {
  const { error } = await supabase
    .from("store_payment_configs")
    .upsert(
      { ...config, store_id: getCurrentStoreId(), updated_at: new Date().toISOString() },
      { onConflict: "store_id" },
    );

  if (error) {
    throw new AdminServiceError("Não foi possível salvar a configuração de pagamento.", error);
  }
}

export async function markOrderPaid(orderId) {
  const { data, error } = await supabase.rpc("mark_order_paid", {
    p_order_id: orderId,
    p_store_id: getCurrentStoreId(),
  });

  if (error) {
    throw new AdminServiceError("Não foi possível marcar o pedido como pago.", error);
  }
  if (!data?.success) {
    throw new AdminServiceError(data?.error || "Não foi possível marcar o pedido como pago.");
  }
  return data;
}
