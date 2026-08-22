// ─────────────────────────────────────────────────────────────
// Edge Function: create-order  (MULTI-LOJA)
//
// Diferenças em relação à versão original de loja única:
//   1. Identifica a loja pelo header "x-store-id" (enviado pelo front-end em
//      toda chamada — mesmo header usado nas queries diretas ao Supabase,
//      ver Supabaseclient.js na documentação).
//   2. Confirma que a loja existe e está ativa antes de processar qualquer coisa.
//   3. Toda consulta a "products" é filtrada por store_id (produtos de outra
//      loja são tratados como "não encontrados" — nunca vazam nem por engano).
//   4. O pedido é gravado com store_id. Os itens do pedido NÃO precisam
//      enviar store_id manualmente: um trigger no banco preenche isso
//      automaticamente a partir do pedido pai.
//
// Aceita convidado (sem sessão) — checkout público. Para venda de balcão
// (admin autenticado, sem entrega), ver a function irmã pdv-sale, que
// reaproveita a mesma lógica de preço/estoque via _shared/orderFulfillment.ts.
// ─────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fulfillOrder, FulfillmentError } from "../_shared/orderFulfillment.ts";

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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 0. Identifica a loja pela requisição.
    //    Aceita tanto o header x-store-id (recomendado, igual às queries diretas)
    //    quanto um campo storeId no corpo (fallback, caso algum client antigo
    //    ainda não tenha sido atualizado).
    const body = await req.json();
    const { deliveryFee = 0, paymentMethod, installments, address, cartItems, storeId: storeIdFromBody } = body;

    const storeId = req.headers.get("x-store-id") ?? storeIdFromBody;

    if (!storeId) {
      return jsonResponse({ error: "Loja não identificada (header x-store-id ausente)." }, 400);
    }

    // Usa service role — bypassa RLS completamente
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // userId nunca vem do corpo da requisição (qualquer client poderia mandar
    // o id de outra pessoa) — é sempre extraído do JWT de quem chamou. Se não
    // houver sessão (checkout como convidado), o client manda a própria anon
    // key e getUser() retorna null → pedido gravado sem user_id, como já era
    // o comportamento esperado pra convidado.
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: { user } } = await authClient.auth.getUser();
    const userId = user?.id ?? null;

    // 0.1 Confirma que a loja existe e está ativa
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, is_active")
      .eq("id", storeId)
      .maybeSingle();

    if (storeError || !store || !store.is_active) {
      return jsonResponse({ error: "Loja inválida ou inativa." }, 400);
    }

    // Fase 1 de pagamentos: todo pedido online nasce "aguardando_pagamento"
    // (dinheiro/cartão na entrega inclusos — o dinheiro só troca de mãos na
    // entrega mesmo, então isso é só um registro informativo, não bloqueia
    // nada do fluxo atual). pix usa a chave da própria loja (sem gateway),
    // por isso o provider é 'pix_manual' — não confundir com uma futura
    // integração via Mercado Pago.
    const paymentProvider = paymentMethod === "pix" ? "pix_manual" : null;

    const { orderId } = await fulfillOrder(supabase, {
      storeId,
      userId,
      cartItems,
      paymentMethod,
      installments,
      deliveryFee,
      address,
      channel: "online",
      status: "pending",
      applyCardFee: true,
      paymentStatus: "aguardando_pagamento",
      paymentProvider,
    });

    return jsonResponse({ orderId }, 200);

  } catch (err) {
    if (err instanceof FulfillmentError) {
      return jsonResponse({ error: err.message }, err.status);
    }
    console.error("Erro inesperado:", err);
    return jsonResponse({ error: "Erro interno do servidor." }, 500);
  }
});
