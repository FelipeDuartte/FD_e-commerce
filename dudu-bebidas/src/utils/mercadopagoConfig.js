import { supabase, getCurrentStoreId } from "../shared/supabase/Supabaseclient";

// RPC pública (SECURITY DEFINER) — devolve só a Public Key (feita pra ser
// pública) e se a loja já configurou as duas credenciais. Nunca devolve o
// Access Token nem a chave do webhook. Ver migration 0007.
export async function getMercadoPagoPublicConfig() {
  const { data, error } = await supabase.rpc("get_mercadopago_public_config", {
    p_store_id: getCurrentStoreId(),
  });

  if (error) {
    console.error("Erro ao buscar configuração do Mercado Pago:", error);
    return { enabled: false, publicKey: null };
  }

  return { enabled: !!data?.enabled, publicKey: data?.public_key ?? null };
}
