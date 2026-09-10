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
  // Pagamento dividido (só PDV/balcão) — ex: parte em dinheiro, parte no
  // cartão. Quando informado (2+ entradas), `paymentMethod` é ignorado e o
  // pedido é salvo com payment_method = 'misto'; o detalhamento vai pra
  // order_payments (usado por close_cash_session pra saber quanto da venda
  // foi de fato em dinheiro).
  payments?: { method: string; amount: number }[];
  // Fiado (só PDV/balcão) — obrigatório quando paymentMethod === 'fiado'.
  // A venda baixa estoque normalmente, mas não gera dinheiro nenhum na
  // hora — vira dívida do cliente em pdv_customers (ver 0012_fiado.sql).
  pdvCustomerId?: string | null;
}

// Taxas reais da maquininha (crédito) — fonte primária agora é
// store_config.credit_installment_fee_rate (site e PDV leem a mesma
// coluna pra exibir o total antes de confirmar). Isso aqui vira só
// fallback, pro caso raro do fetch falhar ou a coluna vir nula — não
// precisa mais manter isso manualmente sincronizado com o front.
const FALLBACK_INSTALLMENT_FEE_RATE: Record<number, number> = {
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
): Promise<{ orderId: string; orderNumber: number; total: number }> {
  const {
    storeId, userId, cartItems, paymentMethod, installments,
    deliveryFee = 0, address, channel, cashSessionId = null,
    soldBy = null, status, applyCardFee, discountAmount = 0,
    paymentStatus, paymentProvider = null, skipStockDecrement = false,
    payments = null, pdvCustomerId = null,
  } = params;

  if (!cartItems || cartItems.length === 0) {
    throw new FulfillmentError("Carrinho vazio.");
  }

  const isSplitPayment = Array.isArray(payments) && payments.length >= 2;

  if (!paymentMethod && !isSplitPayment) {
    throw new FulfillmentError("Forma de pagamento não selecionada.");
  }

  if (isSplitPayment) {
    for (const p of payments!) {
      if (!p.method || !Number.isFinite(p.amount) || p.amount <= 0) {
        throw new FulfillmentError("Pagamento dividido inválido.");
      }
      if (p.method === "fiado") {
        throw new FulfillmentError("Fiado não pode ser combinado com pagamento dividido.");
      }
    }
  }

  if (!isSplitPayment && paymentMethod === "fiado") {
    if (!pdvCustomerId) {
      throw new FulfillmentError("Selecione o cliente para vender fiado.");
    }
    // service role client bypassa RLS — confirma aqui que o cliente é
    // mesmo dessa loja (nunca confia só no id vindo do client).
    const { data: customer } = await supabase
      .from("pdv_customers")
      .select("id")
      .eq("id", pdvCustomerId)
      .eq("store_id", storeId)
      .maybeSingle();
    if (!customer) {
      throw new FulfillmentError("Cliente não encontrado.");
    }
  }

  const effectivePaymentMethod = isSplitPayment ? "misto" : paymentMethod!;

  // installments só faz sentido pra crédito; qualquer outro caso vira null.
  // Pagamento dividido não libera parcelamento (fica sempre null).
  let installmentsToSave: number | null = null;
  if (!isSplitPayment && paymentMethod === "credit_card" && channel === "online") {
    // Dono da loja pediu pra crédito FÍSICO na ENTREGA (site) aceitar só à
    // vista (1x) por enquanto. Balcão (PDV) é outro caso — ver bloco abaixo.
    installmentsToSave = 1;
  } else if (!isSplitPayment && paymentMethod === "credit_card" && channel === "balcao") {
    // PDV libera parcelamento de verdade na maquininha física do balcão —
    // valida a faixa (1 a 8x, mesma tabela de INSTALLMENT_FEE_RATE) em vez
    // de confiar cru no que o client mandou.
    installmentsToSave = Number.isInteger(installments) && (installments as number) >= 1 && (installments as number) <= 8
      ? (installments as number)
      : 1;
  } else if (!isSplitPayment && paymentMethod === "mercadopago_card") {
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
    .select("id, price, old_price, promotion, is_active, stock")
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

  // Promoção é exclusiva do site — venda de balcão (PDV) sempre cobra o
  // preço de tabela (old_price), mesmo que o produto esteja em promoção
  // online. Sem old_price (produto nunca esteve em promoção), cai no price
  // normal, que nesse caso é o mesmo valor pros dois canais.
  const priceFor = (product: { price: number; old_price: number | null; promotion: boolean }) =>
    channel === "balcao" && product.promotion && product.old_price != null
      ? product.old_price
      : product.price;

  const calculatedProductsTotal = cartItems.reduce((sum, item) => {
    const product = products.find((p) => p.id === String(item.id));
    return sum + (product ? priceFor(product) : 0) * item.quantity;
  }, 0);
  let normalizedDeliveryFee = Math.max(0, Number(deliveryFee) || 0);

  // Frete grátis a partir de X (store_config.free_shipping_threshold) —
  // recalculado aqui usando calculatedProductsTotal (já apurado 100% no
  // servidor, direto do banco), nunca a partir do que o client mandou.
  // Só consulta quando há frete a cobrar: venda de balcão nunca manda
  // deliveryFee, então não gasta uma query à toa em toda venda do PDV.
  if (normalizedDeliveryFee > 0) {
    const { data: storeConfig } = await supabase
      .from("store_config")
      .select("free_shipping_threshold")
      .eq("store_id", storeId)
      .maybeSingle();

    const threshold = storeConfig?.free_shipping_threshold;
    if (threshold != null && threshold > 0 && calculatedProductsTotal >= threshold) {
      normalizedDeliveryFee = 0;
    }
  }

  const totalBeforeFee = calculatedProductsTotal + normalizedDeliveryFee;

  // Nunca confia no valor cru vindo do client: desconto não pode ser
  // negativo nem maior que o próprio subtotal (não dá pra "total negativo").
  const normalizedDiscount = Math.min(
    Math.max(0, Number(discountAmount) || 0),
    totalBeforeFee,
  );
  const totalAfterDiscount = totalBeforeFee - normalizedDiscount;

  // Cartão online (Mercado Pago) NÃO entra aqui — a taxa dele é dinâmica
  // (varia por bandeira/emissor do cartão, consultada em tempo real na API
  // do MP) e é aplicada depois, em mercadopago-create-payment, via um
  // UPDATE no total do pedido assim que o valor real com juros é conhecido.
  const chargesCardFee = applyCardFee && paymentMethod === "credit_card";
  let cardFeeRate = 0;
  if (chargesCardFee) {
    // Só consulta quando é crédito de verdade — mesmo motivo do
    // free_shipping_threshold acima, não gasta query à toa nas outras
    // formas de pagamento.
    const { data: storeConfig } = await supabase
      .from("store_config")
      .select("credit_installment_fee_rate")
      .eq("store_id", storeId)
      .maybeSingle();

    const rateTable = storeConfig?.credit_installment_fee_rate ?? FALLBACK_INSTALLMENT_FEE_RATE;
    cardFeeRate = rateTable[installmentsToSave ?? 1] ?? 0;
  }
  const calculatedTotal = roundCents(totalAfterDiscount * (1 + cardFeeRate));
  // Parte do total que é só taxa da maquininha, não valor de produto — o
  // relatório usa isso pra nunca contar taxa como faturamento (ver
  // reportsAggregate.js dos dois lados).
  const cardFeeAmount = roundCents(calculatedTotal - totalAfterDiscount);

  if (isSplitPayment) {
    const paymentsSum = roundCents(payments!.reduce((sum, p) => sum + p.amount, 0));
    if (Math.abs(paymentsSum - calculatedTotal) > 0.01) {
      throw new FulfillmentError(
        `A soma do pagamento dividido (${paymentsSum}) não bate com o total (${calculatedTotal}).`,
      );
    }
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      store_id: storeId,
      user_id: userId,
      total: calculatedTotal,
      discount_amount: normalizedDiscount,
      card_fee_amount: cardFeeAmount,
      payment_method: effectivePaymentMethod,
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
      ...(pdvCustomerId !== null ? { pdv_customer_id: pdvCustomerId } : {}),
    })
    .select("id, order_number")
    .single();

  if (orderError) {
    console.error("[orderFulfillment] Erro ao criar pedido:", orderError);
    throw new FulfillmentError("Não foi possível criar o pedido.", 500);
  }

  if (isSplitPayment) {
    const { error: paymentsError } = await supabase.from("order_payments").insert(
      payments!.map((p) => ({
        order_id: order.id,
        store_id: storeId,
        method: p.method,
        amount: roundCents(p.amount),
      })),
    );
    if (paymentsError) {
      console.error("[orderFulfillment] Erro ao salvar pagamento dividido:", paymentsError);
      throw new FulfillmentError("Erro ao salvar o detalhamento do pagamento.", 500);
    }
  }

  // store_id dos itens é preenchido automaticamente por trigger no banco
  const orderItems = cartItems.map((item) => ({
    order_id: order.id,
    product_id: String(item.id),
    name: item.name,
    price: (() => {
      const product = products.find((p) => p.id === String(item.id));
      return product ? priceFor(product) : item.price;
    })(),
    quantity: item.quantity,
  }));

  const { error: itemsError } = await supabase.from("order_items").insert(orderItems);

  if (itemsError) {
    console.error("[orderFulfillment] Erro ao salvar itens:", itemsError);
    throw new FulfillmentError("Erro ao salvar itens do pedido.", 500);
  }

  if (skipStockDecrement) {
    return { orderId: order.id, orderNumber: order.order_number, total: calculatedTotal };
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

  return { orderId: order.id, orderNumber: order.order_number, total: calculatedTotal };
}
