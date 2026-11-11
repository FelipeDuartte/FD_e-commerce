// Lógica da pix-charge, separada do Deno.serve (index.ts) pra poder ser
// testada sem Deno nem banco (handler.test.ts).

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildPixBrCode, normalizePixPhoneKey } from "../_shared/pixBrCode.ts";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";

export interface PixChargeDeps {
  /** Cliente com service role (ignora RLS). */
  serviceClient(): SupabaseClient;
}

export async function handlePixCharge(req: Request, deps: PixChargeDeps): Promise<Response> {
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
    const supabase = deps.serviceClient();

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
}
