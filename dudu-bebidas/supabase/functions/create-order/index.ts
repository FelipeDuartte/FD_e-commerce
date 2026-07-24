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
//      enviar store_id manualmente: um trigger no banco (05_functions_and_triggers.sql)
//      preenche isso automaticamente a partir do pedido pai.
//   5. A RPC process_order agora recebe também p_store_id.
// ─────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-store-id",
};

// Taxas reais da maquininha (crédito) — mesma tabela usada em Checkout.jsx
// pra exibir o total ao cliente. Duplicada aqui de propósito: o total final
// é sempre recalculado no servidor (nunca confia no que o front manda), então
// essa tabela precisa existir nos dois lugares. Se a taxa da maquininha mudar,
// atualize aqui E no Checkout.jsx.
const INSTALLMENT_FEE_RATE: Record<number, number> = {
  1: 0.0326,
  2: 0.057,
  3: 0.0652,
  4: 0.0736,
  5: 0.0819,
  6: 0.0903,
  7: 0.0988,
  8: 0.1073,
};

function roundCents(v: number): number {
  return Math.round(v * 100) / 100;
}

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
    const { userId, deliveryFee = 0, paymentMethod, installments, address, cartItems, storeId: storeIdFromBody } = body;

    const storeId = req.headers.get("x-store-id") ?? storeIdFromBody;

    if (!storeId) {
      return jsonResponse({ error: "Loja não identificada (header x-store-id ausente)." }, 400);
    }

    // Usa service role — bypassa RLS completamente
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 0.1 Confirma que a loja existe e está ativa
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, is_active")
      .eq("id", storeId)
      .maybeSingle();

    if (storeError || !store || !store.is_active) {
      return jsonResponse({ error: "Loja inválida ou inativa." }, 400);
    }

    // Validações básicas
    if (!cartItems || cartItems.length === 0) {
      return jsonResponse({ error: "Carrinho vazio." }, 400);
    }

    if (!paymentMethod) {
      return jsonResponse({ error: "Forma de pagamento não selecionada." }, 400);
    }

    // installments só faz sentido pra crédito; qualquer outro caso vira null.
    // Sanitiza pra garantir um inteiro razoável mesmo que o front mande algo
    // inesperado (defesa extra, já que o valor final vai direto pro banco).
    let installmentsToSave: number | null = null;
    if (paymentMethod === "credit_card") {
      const n = Number(installments);
      // Limite bate com INSTALLMENT_FEE_RATE acima (e com MAX_INSTALLMENTS
      // do Checkout.jsx) — sem isso, um valor fora da tabela de taxas caía
      // no "?? 0" e a pessoa pagaria parcelado sem nenhuma taxa.
      installmentsToSave = Number.isInteger(n) && n >= 1 && n <= 8 ? n : 1;
    }

    // 1. Buscar preços reais no banco — ignora o total enviado pelo front-end.
    //    IMPORTANTE: filtrado por store_id, então um product_id que existe em
    //    outra loja é tratado exatamente como "não encontrado".
    const productIds = cartItems.map((item: { id: unknown }) => String(item.id));

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, price, is_active, stock")
      .eq("store_id", storeId)
      .in("id", productIds);

    if (productsError || !products) {
      console.error("Erro ao buscar produtos:", productsError);
      return jsonResponse({ error: "Erro ao validar produtos." }, 500);
    }

    // Valida se todos os produtos existem (nesta loja) e estão ativos
    for (const item of cartItems) {
      const product = products.find((p) => p.id === String(item.id));
      if (!product) {
        return jsonResponse({ error: `Produto não encontrado: ${item.id}` }, 400);
      }
      if (!product.is_active) {
        return jsonResponse({ error: `Produto indisponível: ${item.name ?? item.id}` }, 400);
      }
    }

    // Calcula o total real usando os preços do banco
    const calculatedProductsTotal = cartItems.reduce((sum: number, item: { id: unknown; quantity: number }) => {
      const product = products.find((p) => p.id === String(item.id));
      return sum + (product?.price ?? 0) * item.quantity;
    }, 0);
    const normalizedDeliveryFee = Math.max(0, Number(deliveryFee) || 0);
    const totalBeforeFee = calculatedProductsTotal + normalizedDeliveryFee;

    // Taxa da maquininha: só entra quando é crédito, usando o installments
    // já validado/sanitizado acima (installmentsToSave).
    const cardFeeRate =
      paymentMethod === "credit_card" ? INSTALLMENT_FEE_RATE[installmentsToSave ?? 1] ?? 0 : 0;
    const calculatedTotal = roundCents(totalBeforeFee * (1 + cardFeeRate));

    // 2. Inserir o pedido com o total calculado no servidor + store_id
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        store_id:       storeId,
        user_id:        userId ?? null,
        total:          calculatedTotal,
        payment_method: paymentMethod,
        installments:   installmentsToSave,
        address,
        status:         "pending",
      })
      .select("id")
      .single();

    if (orderError) {
      console.error("Erro ao criar pedido:", orderError);
      return jsonResponse({ error: "Não foi possível criar o pedido." }, 500);
    }

    // 3. Inserir os itens (store_id é preenchido automaticamente por trigger)
    const orderItems = cartItems.map((item: { id: unknown; name: string; quantity: number; price?: number }) => ({
      order_id:   order.id,
      product_id: String(item.id),
      name:       item.name,
      price:      products.find((p) => p.id === String(item.id))?.price ?? item.price,
      quantity:   item.quantity,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(orderItems);

    if (itemsError) {
      console.error("Erro ao salvar itens:", itemsError);
      return jsonResponse({ error: "Erro ao salvar itens do pedido." }, 500);
    }

    // 4. Baixa no estoque via RPC (agora store-aware)
    const rpcItems = cartItems.map((item: { id: unknown; quantity: number }) => ({
      product_id: String(item.id),
      quantity:   item.quantity,
    }));

    const { data: rpcResult, error: rpcError } = await supabase.rpc("process_order", {
      p_store_id: storeId,
      p_order_id: order.id,
      p_items:    rpcItems,
    });

    if (rpcError) {
      console.error("Erro na RPC:", rpcError);
      return jsonResponse({ error: "Erro ao atualizar estoque." }, 500);
    }

    if (!rpcResult?.success) {
      return jsonResponse({ error: rpcResult?.error ?? "Erro ao processar estoque." }, 400);
    }

    return jsonResponse({ orderId: order.id }, 200);

  } catch (err) {
    console.error("Erro inesperado:", err);
    return jsonResponse({ error: "Erro interno do servidor." }, 500);
  }
});