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
import { createMercadoPagoPayment, getCardTokenBin, getInstallmentOptions } from "../_shared/mercadopago.ts";

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

function roundCents(v: number): number {
  return Math.round(v * 100) / 100;
}

// Enriquece o payer do Brick (só email + CPF) com nome/telefone/endereço já
// coletados no formulário do Checkout. Documentação oficial do MP: mandar
// esses dados completos reduz recusa falso-positiva do motor antifraude
// deles — hoje mandávamos só o mínimo, o que pode ter contribuído pras
// recusas "não passou nos controles de segurança" logo após ativar
// credenciais de produção.
function buildEnrichedPayer(basePayer: Record<string, unknown>, address: Record<string, unknown> | undefined) {
  const enriched: Record<string, unknown> = { ...basePayer };

  const fullName = typeof address?.name === "string" ? address.name.trim() : "";
  if (fullName) {
    const [firstName, ...rest] = fullName.split(/\s+/);
    enriched.first_name = firstName;
    if (rest.length > 0) enriched.last_name = rest.join(" ");
  }

  const phoneDigits = typeof address?.phone === "string" ? address.phone.replace(/\D/g, "") : "";
  if (phoneDigits.length >= 10) {
    enriched.phone = { area_code: phoneDigits.slice(0, 2), number: phoneDigits.slice(2) };
  }

  const cepDigits = typeof address?.cep === "string" ? address.cep.replace(/\D/g, "") : "";
  const streetName = typeof address?.street === "string" ? address.street : undefined;
  if (cepDigits || streetName) {
    enriched.address = {
      ...(cepDigits ? { zip_code: cepDigits } : {}),
      ...(streetName ? { street_name: streetName } : {}),
      ...(typeof address?.number === "string" ? { street_number: address.number } : {}),
      ...(typeof address?.city === "string" ? { city: address.city } : {}),
    };
  }

  return enriched;
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
      .select("mercadopago_access_token, mercadopago_public_key")
      .eq("store_id", storeId)
      .maybeSingle();

    if (configError || !config?.mercadopago_access_token || !config?.mercadopago_public_key) {
      return jsonResponse({ error: "Pagamento por cartão online não configurado nesta loja." }, 400);
    }

    // Cria o pedido primeiro com o valor BASE (produtos + entrega, sem
    // juros de parcelamento) — payment_status=processando_pagamento,
    // estoque intocado. Se a API do MP falhar depois, o pedido fica
    // registrado como "processando" em vez de sumir sem rastro; o admin
    // consegue ver e o cliente pode tentar de novo.
    const { orderId, total: baseTotal } = await fulfillOrder(supabase, {
      storeId,
      userId,
      cartItems,
      paymentMethod: "mercadopago_card",
      installments,
      deliveryFee,
      address,
      channel: "online",
      status: "pending",
      applyCardFee: false, // taxa/juros do MP são dinâmicos, calculados abaixo
      paymentStatus: "processando_pagamento",
      paymentProvider: "mercadopago",
      skipStockDecrement: true,
    });

    // Descobre o valor REAL a cobrar (com os juros de parcelamento que o
    // próprio Mercado Pago aplica pra essa bandeira/emissor) consultando a
    // tabela oficial deles — nunca calculado a partir de nada que o cliente
    // mandou. O BIN vem do token já criado (não precisa reenviar o número
    // do cartão); o valor-base vem do fulfillOrder acima (nunca do client).
    let finalAmount = baseTotal;
    let paymentMethodOptionId: string | undefined;
    const requestedInstallments = Number.isInteger(installments) && installments > 0 ? installments : 1;

    if (requestedInstallments > 1) {
      const bin = await getCardTokenBin(config.mercadopago_public_key, token);
      const payerCosts = bin
        ? await getInstallmentOptions(config.mercadopago_public_key, baseTotal, bin, paymentMethodId)
        : null;
      const matched = payerCosts?.find((pc) => pc.installments === requestedInstallments);

      if (matched) {
        finalAmount = roundCents(matched.total_amount);
        paymentMethodOptionId = matched.payment_method_option_id;
      } else {
        // Não achou a parcela pedida na tabela oficial (BIN/lookup falhou,
        // ou tentativa de manipular o número de parcelas) — cai pro valor
        // base sem juros, nunca cobra mais do que o pedido realmente vale.
        console.error(
          `[mercadopago-create-payment] Não encontrou parcela ${requestedInstallments}x na tabela do MP (bin=${bin}) — cobrando 1x sem juros. order_id=${orderId}`,
        );
      }
    }

    if (finalAmount !== baseTotal) {
      const { error: updateError } = await supabase
        .from("orders")
        .update({ total: finalAmount })
        .eq("id", orderId);
      if (updateError) {
        console.error("[mercadopago-create-payment] Erro ao atualizar total com juros:", updateError);
      }
    }

    const notificationUrl =
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook?store_id=${storeId}`;

    const result = await createMercadoPagoPayment({
      accessToken: config.mercadopago_access_token,
      transactionAmount: finalAmount,
      token,
      paymentMethodId,
      paymentMethodOptionId,
      issuerId,
      installments: requestedInstallments,
      payer: buildEnrichedPayer(payer, address),
      externalReference: orderId,
      notificationUrl,
      description: `Pedido #${orderId.slice(-8).toUpperCase()}`,
      idempotencyKey: orderId, // 1 pedido = 1 tentativa de cobrança nesta function
    });

    if (!result.ok || !result.payment) {
      // Nem chegou a virar um pagamento de verdade (erro de rede, cartão
      // malformado, etc.) — apaga o pedido, não faz sentido nenhum registro.
      await supabase.rpc("delete_rejected_mercadopago_order", {
        p_order_id: orderId,
        p_store_id: storeId,
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
      // Log do motivo ANTES de apagar o pedido — como a linha some do banco
      // (de propósito, ver comentário abaixo), esse log nos Edge Function
      // Logs é o único jeito de diagnosticar recusas depois (ex:
      // "cc_rejected_high_risk", comum nos primeiros pagamentos de uma
      // conta de produção recém-ativada).
      console.log(
        `[mercadopago-create-payment] Pagamento ${status} — payment_id=${paymentId} status_detail=${status_detail} order_id=${orderId} valor=${finalAmount}`,
      );
      // Recusado pelo banco — o cliente nunca pagou, o pedido nunca chegou
      // a existir de fato. Apaga em vez de só marcar como recusado, pra não
      // deixar rastro de uma "venda" que nunca aconteceu.
      await supabase.rpc("delete_rejected_mercadopago_order", {
        p_order_id: orderId,
        p_store_id: storeId,
      });
    }
    // "in_process"/"pending": não muda nada aqui — payment_status continua
    // 'processando_pagamento' e o webhook decide quando a resposta final
    // chegar (aprova ou apaga, mesma lógica de lá).

    // finalAmount é o valor real cobrado (com os juros de parcelamento do
    // Mercado Pago, consultados na tabela oficial deles acima) — o front
    // usa isso pra tela de confirmação em vez do total que ele mesmo
    // calculou antes de saber quantas parcelas o cliente escolheu no Brick.
    return jsonResponse({ orderId, paymentStatus: status, statusDetail: status_detail, total: finalAmount });

  } catch (err) {
    if (err instanceof FulfillmentError) {
      return jsonResponse({ error: err.message }, err.status);
    }
    console.error("[mercadopago-create-payment] Erro inesperado:", err);
    return jsonResponse({ error: "Erro interno do servidor." }, 500);
  }
});
