// Lógica da create-order, separada do Deno.serve (index.ts) pra poder ser
// testada sem Deno, banco nem rede (handler.test.ts). Tudo que fala com o
// mundo de fora chega por `deps`.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fulfillOrder as realFulfillOrder, FulfillmentError } from "../_shared/orderFulfillment.ts";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";

export interface CreateOrderDeps {
  /** Cliente com service role (ignora RLS). */
  serviceClient(): SupabaseClient;
  /** Usuário logado a partir do header Authorization — null = convidado. */
  getUserId(authorization: string): Promise<string | null>;
  fulfillOrder?: typeof realFulfillOrder;
}

export async function handleCreateOrder(req: Request, deps: CreateOrderDeps): Promise<Response> {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const fulfillOrder = deps.fulfillOrder ?? realFulfillOrder;

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
    const supabase = deps.serviceClient();

    // userId nunca vem do corpo da requisição (qualquer client poderia mandar
    // o id de outra pessoa) — é sempre extraído do JWT de quem chamou. Se não
    // houver sessão (checkout como convidado), o client manda a própria anon
    // key e não há usuário → pedido gravado sem user_id, como já era o
    // comportamento esperado pra convidado.
    const userId = await deps.getUserId(req.headers.get("Authorization") ?? "");

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

    const { orderId, orderNumber } = await fulfillOrder(supabase, {
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

    return jsonResponse({ orderId, orderNumber }, 200);

  } catch (err) {
    if (err instanceof FulfillmentError) {
      return jsonResponse({ error: err.message }, err.status);
    }
    console.error("Erro inesperado:", err);
    return jsonResponse({ error: "Erro interno do servidor." }, 500);
  }
}
