// Lógica da pdv-sale, separada do Deno.serve (index.ts) pra poder ser
// testada sem Deno, banco nem rede (handler.test.ts).

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { StoreAdmin } from "../_shared/authGuard.ts";
import { fulfillOrder as realFulfillOrder, FulfillmentError } from "../_shared/orderFulfillment.ts";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";

export interface PdvSaleDeps {
  /** Admin da loja que chamou (null = não logado ou não é admin). */
  requireStoreAdmin(req: Request): Promise<StoreAdmin | null>;
  /** Cliente com service role (ignora RLS). */
  serviceClient(): SupabaseClient;
  fulfillOrder?: typeof realFulfillOrder;
}

export async function handlePdvSale(req: Request, deps: PdvSaleDeps): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const fulfillOrder = deps.fulfillOrder ?? realFulfillOrder;

  try {
    const admin = await deps.requireStoreAdmin(req);
    if (!admin) {
      return jsonResponse({ error: "Acesso restrito a administradores de loja." }, 403);
    }

    const {
      cartItems, paymentMethod, cashSessionId, discountAmount, payments, pdvCustomerId, installments,
      deferStockUntilPaid, address,
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
    const { orderId, orderNumber } = await fulfillOrder(deps.serviceClient(), {
      storeId: admin.storeId, // sempre a loja do admin — nunca do corpo da requisição
      userId: null, // venda de balcão não tem conta de cliente associada
      cartItems,
      paymentMethod,
      installments: installments ?? null, // só usado quando paymentMethod === 'credit_card'
      address: address ?? {}, // {} = retirada no balcão; preenchido quando a venda é "Entrega"
      channel: "balcao",
      cashSessionId,
      soldBy: admin.userId,
      status: "delivered", // venda presencial já está completa no ato
      // Crédito no balcão cobra a taxa real da maquininha (parcelada); pro
      // resto das formas (dinheiro/pix/débito/fiado) o cálculo interno já
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
}
