// ─────────────────────────────────────────────────────────────
// Edge Function: mercadopago-webhook
//
// Recebe as notificações assíncronas do Mercado Pago (pagamento
// aprovado depois de estar "in_process", estornos, etc). Nunca
// confia em nada do corpo da notificação além do id — sempre
// rebusca o pagamento na API do MP com o access_token da própria
// loja antes de decidir qualquer coisa.
//
// A loja é identificada pelo query param ?store_id=..., configurado
// na URL de notificação de CADA aplicação do MP (uma aplicação =
// uma conta MP = uma loja, nesse desenho). Sem isso não daria pra
// saber qual store_payment_configs.mercadopago_access_token usar só
// a partir do payload — o Mercado Pago não manda esse dado.
//
// Sempre responde 200 rápido pra qualquer notificação que não seja
// "payment" ou que já tenha sido processada — o MP reenvia
// notificações que não recebem 2xx, então tratar como erro faria
// ele martelar o mesmo evento repetidamente.
// ─────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getMercadoPagoPayment, verifyMercadoPagoSignature } from "../_shared/mercadopago.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok");
  }

  try {
    const url = new URL(req.url);
    const storeId = url.searchParams.get("store_id");
    if (!storeId) {
      // 200 de propósito: não é um erro do MP, é uma URL mal configurada
      // no nosso lado — não queremos que ele fique reenviando pra sempre.
      console.error("[mercadopago-webhook] store_id ausente na URL de notificação.");
      return jsonResponse({ received: true }, 200);
    }

    const body = await req.json().catch(() => ({}));
    const dataId = body?.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id");
    const type = body?.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");

    if (type !== "payment" || !dataId) {
      // Outros tipos de notificação (merchant_order, etc.) — ignora.
      return jsonResponse({ received: true }, 200);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: config } = await supabase
      .from("store_payment_configs")
      .select("mercadopago_access_token, mercadopago_webhook_secret")
      .eq("store_id", storeId)
      .maybeSingle();

    if (!config?.mercadopago_access_token) {
      console.error("[mercadopago-webhook] Loja sem configuração do Mercado Pago:", storeId);
      return jsonResponse({ received: true }, 200);
    }

    // Assinatura só é validada se a loja já tiver configurado a chave
    // secreta (evita quebrar em ambiente de teste antes de configurar) —
    // mas se a chave existir, a assinatura É obrigatória.
    if (config.mercadopago_webhook_secret) {
      const valid = await verifyMercadoPagoSignature({
        xSignature: req.headers.get("x-signature"),
        xRequestId: req.headers.get("x-request-id"),
        dataId: String(dataId),
        secret: config.mercadopago_webhook_secret,
      });
      if (!valid) {
        console.error("[mercadopago-webhook] Assinatura inválida para store_id:", storeId);
        return jsonResponse({ error: "Assinatura inválida." }, 401);
      }
    }

    const payment = await getMercadoPagoPayment(config.mercadopago_access_token, String(dataId));
    if (!payment || !payment.external_reference) {
      console.error("[mercadopago-webhook] Pagamento não encontrado ou sem external_reference:", dataId);
      return jsonResponse({ received: true }, 200);
    }

    const orderId = payment.external_reference;

    if (payment.status === "approved") {
      await supabase.rpc("confirm_mercadopago_payment", {
        p_order_id: orderId,
        p_store_id: storeId,
        p_payment_id: String(payment.id),
      });
    } else if (["rejected", "cancelled"].includes(payment.status)) {
      console.log(
        `[mercadopago-webhook] Pagamento ${payment.status} — payment_id=${payment.id} status_detail=${payment.status_detail} order_id=${orderId}`,
      );
      // Ficou "in_process" na resposta síncrona e só resolveu como recusado
      // depois, via webhook — mesmo critério do caminho síncrono: apaga em
      // vez de manter um registro de venda que nunca aconteceu.
      await supabase.rpc("delete_rejected_mercadopago_order", {
        p_order_id: orderId,
        p_store_id: storeId,
      });
    }
    // "in_process"/"pending"/outros: nada a fazer ainda, aguarda próxima notificação.

    return jsonResponse({ received: true }, 200);

  } catch (err) {
    console.error("[mercadopago-webhook] Erro inesperado:", err);
    // Ainda assim 200 — um erro nosso não deveria fazer o MP martelar
    // reenvios; o pior caso fica visível nos logs da function pra investigar.
    return jsonResponse({ received: true }, 200);
  }
});
