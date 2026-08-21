// ─────────────────────────────────────────────────────────────
// Helper compartilhado: recalcula preços reais no banco, insere
// orders + order_items e baixa estoque via RPC process_order.
// Usado tanto por create-order (checkout online/convidado) quanto
// por pdv-sale (venda de balcão, admin autenticado) — a lógica
// financeira/estoque é a mesma nos dois casos, só muda quem pode
// chamar e quais campos extras cada um preenche.
// ─────────────────────────────────────────────────────────────

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export class FulfillmentError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

interface CartItemInput {
  id: unknown;
  name?: string;
  quantity: number;
  price?: number;
}

export interface FulfillOrderParams {
  storeId: string;
  userId: string | null;
  cartItems: CartItemInput[];
  paymentMethod: string;
  installments: number | null;
  deliveryFee?: number;
  address: Record<string, unknown>;
  channel: "online" | "balcao";
  cashSessionId?: string | null;
  soldBy?: string | null;
  status: string;
  // Desconto manual em R$ sobre o subtotal (produtos + entrega), aplicado
  // antes da taxa de cartão. Hoje só o PDV usa isso (atendente de balcão
  // pode negociar desconto que o site não oferece).
  discountAmount?: number;
  // Taxa da maquininha (crédito) só faz sentido pro checkout online — uma
  // venda de balcão cobra o preço de tabela, a taxa física já costuma estar
  // embutida no preço pro lojista.
  applyCardFee: boolean;
  // Status de PAGAMENTO — separado do status de preparo/entrega (`status`
  // acima). Default 'pago' no banco cobre quem não passa isso (PDV, por
  // exemplo — venda de balcão já é paga no ato). Só create-order passa
  // 'aguardando_pagamento' pra pix/pagamento na entrega.
  paymentStatus?: string;
  // null = sem gateway (pix da própria loja, pagamento na entrega);
  // 'pix_manual' ou 'mercadopago'.
  paymentProvider?: string | null;
  // Fase 2 (cartão online MP): o estoque só pode ser baixado quando o
  // pagamento for de fato aprovado, nunca no momento da criação do pedido
  // (diferente de todo o resto — pix/entrega baixam na hora, Fase 1). Quem
  // chama com true precisa baixar o estoque depois via a RPC
  // confirm_mercadopago_payment, no momento da aprovação.
  skipStockDecrement?: boolean;
}

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

export async function fulfillOrder(
  supabase: SupabaseClient,
  params: FulfillOrderParams,
): Promise<{ orderId: string; total: number }> {
  const {
    storeId, userId, cartItems, paymentMethod, installments,
    deliveryFee = 0, address, channel, cashSessionId = null,
    soldBy = null, status, applyCardFee, discountAmount = 0,
    paymentStatus, paymentProvider = null, skipStockDecrement = false,
  } = params;

  if (!cartItems || cartItems.length === 0) {
    throw new FulfillmentError("Carrinho vazio.");
  }

  if (!paymentMethod) {
    throw new FulfillmentError("Forma de pagamento não selecionada.");
  }

  // installments só faz sentido pra crédito; qualquer outro caso vira null.
  let installmentsToSave: number | null = null;
  if (paymentMethod === "credit_card") {
    // Dono da loja pediu pra crédito FÍSICO (na entrega) aceitar só à vista
    // (1x) por enquanto — ver histórico em create-order. Se voltar a liberar
    // parcelamento, é só trocar o "1" fixo abaixo pela validação de faixa
    // recebida em `installments`.
    installmentsToSave = 1;
  } else if (paymentMethod === "mercadopago_card") {
    // Cartão online JÁ libera parcelamento de verdade — quem decide quantas
    // vezes é o próprio Card Payment Brick (baseado no que a bandeira/emissor
    // permite), não a regra fixa de 1x do cartão físico acima.
    installmentsToSave = Number.isInteger(installments) && (installments as number) > 0
      ? (installments as number)
      : 1;
  }

  // Buscar preços reais no banco — ignora qualquer total enviado pelo
  // client. Filtrado por store_id, então um product_id que existe em outra
  // loja é tratado exatamente como "não encontrado".
  const productIds = cartItems.map((item) => String(item.id));

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, price, is_active, stock")
    .eq("store_id", storeId)
    .in("id", productIds);

  if (productsError || !products) {
    console.error("[orderFulfillment] Erro ao buscar produtos:", productsError);
    throw new FulfillmentError("Erro ao validar produtos.", 500);
  }

  for (const item of cartItems) {
    const product = products.find((p) => p.id === String(item.id));
    if (!product) {
      throw new FulfillmentError(`Produto não encontrado: ${item.id}`);
    }
    if (!product.is_active) {
      throw new FulfillmentError(`Produto indisponível: ${item.name ?? item.id}`);
    }
  }

  const calculatedProductsTotal = cartItems.reduce((sum, item) => {
    const product = products.find((p) => p.id === String(item.id));
    return sum + (product?.price ?? 0) * item.quantity;
  }, 0);
  const normalizedDeliveryFee = Math.max(0, Number(deliveryFee) || 0);
  const totalBeforeFee = calculatedProductsTotal + normalizedDeliveryFee;

  // Nunca confia no valor cru vindo do client: desconto não pode ser
  // negativo nem maior que o próprio subtotal (não dá pra "total negativo").
  const normalizedDiscount = Math.min(
    Math.max(0, Number(discountAmount) || 0),
    totalBeforeFee,
  );
  const totalAfterDiscount = totalBeforeFee - normalizedDiscount;

  const cardFeeRate =
    applyCardFee && paymentMethod === "credit_card"
      ? INSTALLMENT_FEE_RATE[installmentsToSave ?? 1] ?? 0
      : 0;
  const calculatedTotal = roundCents(totalAfterDiscount * (1 + cardFeeRate));

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      store_id: storeId,
      user_id: userId,
      total: calculatedTotal,
      discount_amount: normalizedDiscount,
      payment_method: paymentMethod,
      installments: installmentsToSave,
      address,
      status,
      channel,
      cash_session_id: cashSessionId,
      sold_by: soldBy,
      // Omite as duas chaves quando o caller não informa (ex: pdv-sale) —
      // assim o DEFAULT 'pago'/null da coluna no banco continua valendo,
      // em vez de mandar undefined explicitamente.
      ...(paymentStatus !== undefined ? { payment_status: paymentStatus } : {}),
      ...(paymentProvider !== null ? { payment_provider: paymentProvider } : {}),
    })
    .select("id")
    .single();

  if (orderError) {
    console.error("[orderFulfillment] Erro ao criar pedido:", orderError);
    throw new FulfillmentError("Não foi possível criar o pedido.", 500);
  }

  // store_id dos itens é preenchido automaticamente por trigger no banco
  const orderItems = cartItems.map((item) => ({
    order_id: order.id,
    product_id: String(item.id),
    name: item.name,
    price: products.find((p) => p.id === String(item.id))?.price ?? item.price,
    quantity: item.quantity,
  }));

  const { error: itemsError } = await supabase.from("order_items").insert(orderItems);

  if (itemsError) {
    console.error("[orderFulfillment] Erro ao salvar itens:", itemsError);
    throw new FulfillmentError("Erro ao salvar itens do pedido.", 500);
  }

  if (skipStockDecrement) {
    return { orderId: order.id, total: calculatedTotal };
  }

  const rpcItems = cartItems.map((item) => ({
    product_id: String(item.id),
    quantity: item.quantity,
  }));

  const { data: rpcResult, error: rpcError } = await supabase.rpc("process_order", {
    p_store_id: storeId,
    p_order_id: order.id,
    p_items: rpcItems,
  });

  if (rpcError) {
    console.error("[orderFulfillment] Erro na RPC:", rpcError);
    throw new FulfillmentError("Erro ao atualizar estoque.", 500);
  }

  if (!rpcResult?.success) {
    throw new FulfillmentError(rpcResult?.error ?? "Erro ao processar estoque.");
  }

  return { orderId: order.id, total: calculatedTotal };
}
