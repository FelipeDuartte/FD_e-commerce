// ─────────────────────────────────────────────────────────────
// Edge Function: pdv-sale
//
// Registra uma venda de balcão (PDV) feita por um admin da loja.
// Diferente de create-order: não existe caminho anônimo aqui —
// exige que quem chamou seja admin da própria loja (requireStoreAdmin).
// Reaproveita a mesma lógica de recálculo de preço/baixa de estoque
// via _shared/orderFulfillment.ts (mesmo caminho do checkout online).
//
// Body esperado:
//   { "cartItems": [{ "id": "...", "quantity": 2 }], "paymentMethod": "cash",
//     "cashSessionId": "uuid-do-caixa-aberto", "discountAmount": 5.00 }
// discountAmount é opcional, em R$, sobre o subtotal — desconto que o
// atendente decide dar (o site não tem isso hoje).
//
// Pagamento dividido: manda "payments": [{ "method": "cash", "amount": 20 },
// { "method": "credit_card", "amount": 30 }] em vez de "paymentMethod" —
// precisa somar exatamente o total do pedido (fulfillOrder valida).
//
// paymentMethod "credit_card" (forma única, não dividida) aceita
// "installments": 1 a 8 — cobra a taxa real da maquininha por fora do preço
// de tabela (ver INSTALLMENT_FEE_RATE em orderFulfillment.ts).
//
// "deferStockUntilPaid": true (só pedido fiado criado com produtos na aba
// Clientes) — não baixa estoque na hora, só quando o pagamento do cliente
// cobrir esse pedido (ver settle_fiado_stock). Omitido/false em todo o
// resto: venda de balcão baixa estoque no ato, como sempre.
// ─────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireStoreAdmin } from "../_shared/authGuard.ts";
import { fulfillOrder, FulfillmentError } from "../_shared/orderFulfillment.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  // x-store-id é injetado automaticamente em TODA chamada pelo Supabaseclient.js
  // (mesmo fetch global usado pelas queries diretas), então precisa estar
  // liberado aqui mesmo essa function não usando o header pra nada — senão o
  // preflight de CORS falha antes da requisição sair do navegador.
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
    const admin = await requireStoreAdmin(req);
    if (!admin) {
      return jsonResponse({ error: "Acesso restrito a administradores de loja." }, 403);
    }

    const {
      cartItems, paymentMethod, cashSessionId, discountAmount, payments, pdvCustomerId, installments,
      deferStockUntilPaid,
    } = await req.json();

    if (!cashSessionId) {
      return jsonResponse({ error: "Nenhum caixa aberto informado." }, 400);
    }

    // Confirma que o caixa é da própria loja do admin e está aberto — usa o
    // client autenticado do admin (RLS de cash_sessions já isola por loja
    // via is_store_admin, então um caixa de outra loja simplesmente não é
    // encontrado aqui).
    const { data: session, error: sessionError } = await admin.client
      .from("cash_sessions")
      .select("id, status")
      .eq("id", cashSessionId)
      .maybeSingle();

    if (sessionError || !session || session.status !== "open") {
      return jsonResponse({ error: "Caixa inválido ou já fechado." }, 400);
    }

    // A partir daqui, usa service role — mesma necessidade do create-order
    // (não existe policy de INSERT em orders/order_items pra ninguém).
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { orderId, orderNumber } = await fulfillOrder(serviceClient, {
      storeId: admin.storeId,
      userId: null, // venda de balcão não tem conta de cliente associada
      cartItems,
      paymentMethod,
      installments: installments ?? null, // só usado quando paymentMethod === 'credit_card'
      address: {}, // orders.address é jsonb NOT NULL, sem uso pra venda presencial
      channel: "balcao",
      cashSessionId,
      soldBy: admin.userId,
      status: "delivered", // venda presencial já está completa no ato
      // Crédito no balcão agora cobra a taxa real da maquininha (parcelada);
      // pro resto das formas (dinheiro/pix/débito/fiado) o cálculo interno já
      // zera a taxa sozinho, então passar true aqui não afeta elas.
      applyCardFee: true,
      discountAmount, // clamp/validação real acontece dentro do fulfillOrder
      payments, // pagamento dividido (2+ formas) — validação real dentro do fulfillOrder
      pdvCustomerId, // fiado — obrigatório quando paymentMethod === 'fiado', validado dentro do fulfillOrder
      // Pedido fiado criado com produtos direto na aba Clientes: não baixa
      // estoque na hora, só quando o pagamento cobrir esse pedido (ver
      // settle_fiado_stock). Nunca usado pela venda normal do balcão.
      skipStockDecrement: !!deferStockUntilPaid,
    });

    return jsonResponse({ orderId, orderNumber }, 200);

  } catch (err) {
    if (err instanceof FulfillmentError) {
      return jsonResponse({ error: err.message }, err.status);
    }
    console.error("[pdv-sale] Erro inesperado:", err);
    return jsonResponse({ error: "Erro interno do servidor." }, 500);
  }
});
