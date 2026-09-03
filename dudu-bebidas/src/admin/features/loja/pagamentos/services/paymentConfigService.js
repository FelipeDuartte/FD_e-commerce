import { supabase, getCurrentStoreId } from "../../../../../shared/supabase/Supabaseclient";
import { AdminServiceError } from "../../../../shared/services/AdminServiceError";

// mercadopago_access_token e mercadopago_webhook_secret nunca voltam pro
// navegador (mesmo sendo o próprio admin da loja) — só indicamos se já
// estão configurados, pra UI mostrar um placeholder tipo "•••• já
// configurado" em vez do valor real. Ver comentário na migration 0006.
const SENSITIVE_FIELDS = ["mercadopago_access_token", "mercadopago_webhook_secret"];

// Existem só pra UI decidir qual placeholder mostrar — não são colunas reais.
const UI_ONLY_FIELDS = ["mercadopago_access_token_set", "mercadopago_webhook_secret_set"];

export async function getPaymentConfig() {
  const { data, error } = await supabase
    .from("store_payment_configs")
    .select(
      "pix_key, pix_key_type, pix_merchant_name, pix_merchant_city, " +
      "mercadopago_public_key, mercadopago_environment",
    )
    .eq("store_id", getCurrentStoreId())
    .maybeSingle();

  if (error) {
    throw new AdminServiceError("Não foi possível carregar a configuração de pagamento.", error);
  }

  // Consulta separada só pra saber SE os campos sensíveis estão preenchidos
  // (IS NOT NULL), nunca o valor — head:true não baixa nenhuma linha.
  const { count: accessTokenCount } = await supabase
    .from("store_payment_configs")
    .select("store_id", { count: "exact", head: true })
    .eq("store_id", getCurrentStoreId())
    .not("mercadopago_access_token", "is", null);

  const { count: webhookSecretCount } = await supabase
    .from("store_payment_configs")
    .select("store_id", { count: "exact", head: true })
    .eq("store_id", getCurrentStoreId())
    .not("mercadopago_webhook_secret", "is", null);

  return {
    ...data,
    mercadopago_access_token_set: (accessTokenCount ?? 0) > 0,
    mercadopago_webhook_secret_set: (webhookSecretCount ?? 0) > 0,
  };
}

// Upsert em vez de update puro (diferente de updateStoreConfig): a loja
// pode não ter linha em store_payment_configs ainda — um update simples
// silenciosamente não faria nada nesse caso.
//
// Campos sensíveis (access token / webhook secret) só entram no payload se
// o admin realmente digitou um valor novo — omitir a chave (em vez de
// mandar string vazia) faz o upsert preservar o que já estava salvo, já
// que o UPDATE gerado só toca nas colunas presentes no objeto.
export async function updatePaymentConfig(config) {
  const payload = { ...config };
  for (const field of UI_ONLY_FIELDS) {
    delete payload[field];
  }
  for (const field of SENSITIVE_FIELDS) {
    if (!payload[field]) delete payload[field];
  }

  const { error } = await supabase
    .from("store_payment_configs")
    .upsert(
      { ...payload, store_id: getCurrentStoreId(), updated_at: new Date().toISOString() },
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
