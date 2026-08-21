// ─────────────────────────────────────────────────────────────
// Edge Function: mercadopago-create-payment
//
// Fase 2 de pagamentos: cartão de crédito online via Mercado Pago
// (Card Payment Brick). Recebe o token de cartão já tokenizado pelo
// Brick no navegador do cliente (o número/CVV nunca passam por aqui)
// e faz DUAS coisas atômicas do ponto de vista do cliente, numa
// única chamada:
//   1. Cria o pedido (mesma validação de preço/estoque de sempre,
//      via fulfillOrder) — mas com skipStockDecrement: o estoque só
//      é baixado quando o pagamento for de fato aprovado.
//   2. Chama a Payments API do Mercado Pago com o token, valor
//      calculado no SERVIDOR (nunca o que o client mandar) e
//      external_reference = id do pedido, pra o webhook conseguir
//      achar o pedido depois.
//
// Se a API do MP responder na hora (comum pra cartão): 'approved' já
// baixa o estoque aqui mesmo via confirm_mercadopago_payment;
// 'rejected' não baixa nada; 'in_process' fica pendente — o webhook
// resolve depois, dos dois jeitos usando a mesma RPC (idempotente).
// ─────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fulfillOrder, FulfillmentError } from "../_shared/orderFulfillment.ts";
import { createMercadoPagoPayment } from "../_shared/mercadopago.ts";

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
    const body = await req.json();
    const {
      deliveryFee = 0, address, cartItems, storeId: storeIdFromBody,
      token, paymentMethodId, issuerId, installments, payer,
    } = body;

    const storeId = req.headers.get("x-store-id") ?? storeIdFromBody;

    if (!storeId) {
      return jsonResponse({ error: "Loja não identificada (header x-store-id ausente)." }, 400);
    }
    if (!token || !paymentMethodId || !payer?.email) {
      return jsonResponse({ error: "Dados do cartão incompletos." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: { user } } = await authClient.auth.getUser();
    const userId = user?.id ?? null;

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, is_active")
      .eq("id", storeId)
      .maybeSingle();

    if (storeError || !store || !store.is_active) {
      return jsonResponse({ error: "Loja inválida ou inativa." }, 400);
    }

    const { data: config, error: configError } = await supabase
      .from("store_payment_configs")
      .select("mercadopago_access_token")
      .eq("store_id", storeId)
      .maybeSingle();

    if (configError || !config?.mercadopago_access_token) {
      return jsonResponse({ error: "Pagamento por cartão online não configurado nesta loja." }, 400);
    }

    // Cria o pedido primeiro (payment_status=processando_pagamento,
    // estoque intocado) — se a API do MP falhar depois, o pedido fica
    // registrado como "processando" em vez de sumir sem rastro; o admin
    // consegue ver e o cliente pode tentar de novo.
    const { orderId, total } = await fulfillOrder(supabase, {
      storeId,
      userId,
      cartItems,
      paymentMethod: "mercadopago_card",
      installments,
      deliveryFee,
      address,
      channel: "online",
      status: "pending",
      applyCardFee: false, // taxa do MP sai da loja, não é repassada ao cliente
      paymentStatus: "processando_pagamento",
      paymentProvider: "mercadopago",
      skipStockDecrement: true,
    });

    const notificationUrl =
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook?store_id=${storeId}`;

    const result = await createMercadoPagoPayment({
      accessToken: config.mercadopago_access_token,
      transactionAmount: total,
      token,
      paymentMethodId,
      issuerId,
      installments: installments ?? 1,
      payer,
      externalReference: orderId,
      notificationUrl,
      description: `Pedido #${orderId.slice(-8).toUpperCase()}`,
      idempotencyKey: orderId, // 1 pedido = 1 tentativa de cobrança nesta function
    });

    if (!result.ok || !result.payment) {
      await supabase.rpc("mark_mercadopago_payment_failed", {
        p_order_id: orderId,
        p_store_id: storeId,
        p_status: "pagamento_recusado",
        p_payment_id: null,
      });
      return jsonResponse({ error: result.error ?? "Não foi possível processar o pagamento." }, 400);
    }

    const { status, id: paymentId, status_detail } = result.payment;

    if (status === "approved") {
      await supabase.rpc("confirm_mercadopago_payment", {
        p_order_id: orderId,
        p_store_id: storeId,
        p_payment_id: String(paymentId),
      });
    } else if (status === "rejected" || status === "cancelled") {
      await supabase.rpc("mark_mercadopago_payment_failed", {
        p_order_id: orderId,
        p_store_id: storeId,
        p_status: "pagamento_recusado",
        p_payment_id: String(paymentId),
      });
    }
    // "in_process"/"pending": não muda nada aqui — payment_status continua
    // 'processando_pagamento' e o webhook decide quando a resposta final
    // chegar (mesmas RPCs, idempotentes).

    return jsonResponse({ orderId, paymentStatus: status, statusDetail: status_detail });

  } catch (err) {
    if (err instanceof FulfillmentError) {
      return jsonResponse({ error: err.message }, err.status);
    }
    console.error("[mercadopago-create-payment] Erro inesperado:", err);
    return jsonResponse({ error: "Erro interno do servidor." }, 500);
  }
});
