// ─────────────────────────────────────────────────────────────
// Edge Function: pix-charge
//
// Gera o QR/"Pix Copia e Cola" de um pedido já criado, usando a
// chave Pix cadastrada pela própria loja (sem gateway/PSP). Não cria
// nada — só lê o pedido (valor real, já calculado no servidor pelo
// create-order) e a configuração de pagamento da loja, e monta o
// payload padronizado do BACEN.
//
// Body esperado: { "orderId": "uuid", "storeId": "uuid" }
// Resposta: { brCode, pixKey, merchantName, amount }
// ─────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildPixBrCode, normalizePixPhoneKey } from "../_shared/pixBrCode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-store-id",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { orderId, storeId } = await req.json();

    if (!orderId || !storeId) {
      return jsonResponse({ error: "orderId e storeId são obrigatórios." }, 400);
    }

    // Service role: essa function precisa ler store_payment_configs (sem
    // policy de leitura pública) e confirmar o pedido independente de quem
    // está chamando (convidado incluso, mesmo modelo do get_order_status —
    // só quem já sabe o UUID do pedido consegue chamar).
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, total, payment_method")
      .eq("id", orderId)
      .eq("store_id", storeId)
      .maybeSingle();

    if (orderError || !order) {
      return jsonResponse({ error: "Pedido não encontrado." }, 404);
    }

    if (order.payment_method !== "pix") {
      return jsonResponse({ error: "Este pedido não é pago via Pix." }, 400);
    }

    const { data: config, error: configError } = await supabase
      .from("store_payment_configs")
      .select("pix_key, pix_key_type, pix_merchant_name, pix_merchant_city")
      .eq("store_id", storeId)
      .maybeSingle();

    if (configError || !config?.pix_key) {
      return jsonResponse({ error: "Esta loja ainda não configurou a chave Pix." }, 400);
    }

    // Chave tipo telefone PRECISA estar em +5531999998888 — sem isso o
    // banco não encontra a chave e recusa o pagamento (era exatamente o
    // erro relatado: admin digitou sem o +55).
    const pixKey =
      config.pix_key_type === "telefone"
        ? normalizePixPhoneKey(config.pix_key)
        : config.pix_key;

    // txid derivado do próprio pedido — alfanumérico, sem traços, até 25
    // caracteres (limite do campo pela spec do BACEN).
    const txid = order.id.replace(/-/g, "").toUpperCase();

    const brCode = buildPixBrCode({
      pixKey,
      merchantName: config.pix_merchant_name || "LOJA",
      merchantCity: config.pix_merchant_city || "BRASIL",
      amount: Number(order.total),
      txid,
    });

    return jsonResponse({
      brCode,
      pixKey,
      merchantName: config.pix_merchant_name || "Loja",
      amount: order.total,
    });
  } catch (err) {
    console.error("[pix-charge] Erro inesperado:", err);
    return jsonResponse({ error: "Erro ao gerar cobrança Pix." }, 500);
  }
});
