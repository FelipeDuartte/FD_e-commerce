// ─────────────────────────────────────────────────────────────
// Checkout Integrado da InfinitePay — montagem do link de pagamento e
// confirmação do pagamento. Usado por infinitepay-checkout (cria o link /
// confere na volta do cliente) e infinitepay-webhook (aviso da InfinitePay).
//
// Regras da loja (definidas com o dono):
//   - Pix: valor normal, sem taxa.
//   - Cartão em até 12x (decisão do operador, nov/2026): qualquer taxa e os
//     juros do parcelamento são somados ao valor do cliente
//     (assured_installments: 0) — a loja recebe sempre o valor cheio.
//
// SEGURANÇA: o aviso (webhook) da InfinitePay NÃO tem assinatura. Nada do
// corpo do aviso é usado pra decidir — o pagamento é sempre conferido no
// /payment_check com a chave da própria loja, e o valor tem que bater com
// o total do pedido salvo no banco.
//
// Documentação: https://www.infinitepay.io/checkout-documentacao
// ─────────────────────────────────────────────────────────────

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const INFINITEPAY_API = "https://api.checkout.infinitepay.io";
/** Validade do link de pagamento. Depois disso o pedido não pago some. */
export const LINK_VALIDITY_MINUTES = 30;
const MIN_AMOUNT_CENTS = 100; // mínimo da InfinitePay: R$ 1,00

export const toCents = (value: number | string) => Math.round(Number(value) * 100);

export interface InfinitePayConfig {
  handle: string; // InfiniteTag sem o $
  apiKey: string; // inchk_... (só no servidor)
}

export interface LinkItem {
  description: string;
  price: number; // centavos
  quantity: number;
}

export interface OrderForLink {
  id: string;
  order_number: number;
  total: number; // reais, já com o frete
  address: { name?: string; phone?: string } | null;
}

export interface OrderItemForLink {
  name: string;
  price: number; // reais
  quantity: number;
}

export class InfinitePayError extends Error {}

/**
 * Itens do link somando EXATAMENTE o total do pedido: um por produto e a
 * diferença (frete) como "Entrega". Se por algum motivo não fechar, manda
 * uma linha só com o pedido inteiro — o valor cobrado nunca diverge.
 */
export function linkItems(order: OrderForLink, items: OrderItemForLink[]): LinkItem[] {
  const totalCents = toCents(order.total);
  const lines = items.map((i) => ({
    description: i.name.slice(0, 60),
    price: toCents(i.price),
    quantity: i.quantity,
  }));
  const productsCents = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  const rest = totalCents - productsCents;

  if (rest === 0 && lines.length) return lines;
  if (rest > 0 && lines.length) return [...lines, { description: "Entrega", price: rest, quantity: 1 }];
  return [{ description: `Pedido #${order.order_number}`, price: totalCents, quantity: 1 }];
}

/** Telefone no formato da InfinitePay (+55DDDNÚMERO) — ou null se não der. */
export function customerPhone(raw: string | undefined | null): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return `+${digits}`;
  return null;
}

export function buildLinkPayload({
  order,
  items,
  config,
  siteUrl,
  webhookUrl,
  now = new Date(),
}: {
  order: OrderForLink;
  items: OrderItemForLink[];
  config: InfinitePayConfig;
  siteUrl: string | null;
  webhookUrl: string;
  now?: Date;
}): Record<string, unknown> {
  if (toCents(order.total) < MIN_AMOUNT_CENTS) {
    throw new InfinitePayError("O valor mínimo para pagar online é R$ 1,00.");
  }

  const payload: Record<string, unknown> = {
    handle: config.handle,
    items: linkItems(order, items),
    order_nsu: order.id,
    webhook: { url: webhookUrl, events: ["paid"] },
    options: {
      assured_installments: 0, // toda taxa de cartão fica com o cliente
      single_payment: true, // pagou uma vez, o link trava
      require_delivery_address: false, // o endereço já foi informado no checkout do site
      valid_until: new Date(now.getTime() + LINK_VALIDITY_MINUTES * 60_000).toISOString(),
    },
  };
  if (siteUrl) payload.redirect_url = `${siteUrl.replace(/\/$/, "")}/confirmacao`;

  const name = order.address?.name?.trim();
  const phone = customerPhone(order.address?.phone);
  if (name || phone) {
    payload.customer = { ...(name ? { name } : {}), ...(phone ? { phone_number: phone } : {}) };
  }
  return payload;
}

type FetchFn = typeof fetch;

/** Cria o link de pagamento. Devolve a URL pra mandar o cliente. */
export async function createPaymentLink(
  payload: Record<string, unknown>,
  config: InfinitePayConfig,
  fetchFn: FetchFn = fetch,
): Promise<string> {
  const res = await fetchFn(`${INFINITEPAY_API}/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": config.apiKey },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[infinitepay] Erro ao criar link:", res.status, JSON.stringify(body));
    throw new InfinitePayError("Não foi possível iniciar o pagamento online. Tente novamente.");
  }
  // A documentação não fixa o nome do campo — aceita os nomes prováveis.
  const url = body?.url ?? body?.link ?? body?.checkout_url ?? body?.payment_url;
  if (typeof url !== "string" || !url.startsWith("https://")) {
    console.error("[infinitepay] Resposta sem URL do link:", JSON.stringify(body));
    throw new InfinitePayError("Não foi possível iniciar o pagamento online. Tente novamente.");
  }
  return url;
}

export interface PaymentCheckResult {
  paid: boolean;
  amount: number; // centavos — valor original do link
  paidAmount: number; // centavos — o que o cliente pagou (pode ter juros do cartão)
  installments: number | null;
  captureMethod: "pix" | "credit_card" | null;
}

/** Pergunta à InfinitePay se o pagamento foi aprovado. Nunca lança: falha = não pago. */
export async function checkPayment(
  ids: { orderNsu: string; transactionNsu: string; slug: string },
  config: InfinitePayConfig,
  fetchFn: FetchFn = fetch,
): Promise<PaymentCheckResult> {
  const notPaid: PaymentCheckResult = { paid: false, amount: 0, paidAmount: 0, installments: null, captureMethod: null };
  try {
    const res = await fetchFn(`${INFINITEPAY_API}/payment_check`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": config.apiKey },
      body: JSON.stringify({
        handle: config.handle,
        order_nsu: ids.orderNsu,
        transaction_nsu: ids.transactionNsu,
        slug: ids.slug,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body?.success === false || body?.paid !== true) return notPaid;
    return {
      paid: true,
      amount: Number(body.amount) || 0,
      paidAmount: Number(body.paid_amount ?? body.amount) || 0,
      installments: Number.isInteger(body.installments) ? body.installments : null,
      captureMethod: body.capture_method === "pix" || body.capture_method === "credit_card"
        ? body.capture_method
        : null,
    };
  } catch (err) {
    console.error("[infinitepay] Erro ao conferir pagamento:", err);
    return notPaid;
  }
}

/** Configuração da InfinitePay da loja (service role). null = loja sem InfinitePay. */
export async function loadInfinitePayConfig(db: SupabaseClient, storeId: string): Promise<InfinitePayConfig | null> {
  const { data } = await db
    .from("store_payment_configs")
    .select("infinitepay_handle, infinitepay_api_key")
    .eq("store_id", storeId)
    .maybeSingle();
  if (!data?.infinitepay_handle || !data?.infinitepay_api_key) return null;
  return { handle: String(data.infinitepay_handle).replace(/^\$/, "").trim(), apiKey: data.infinitepay_api_key };
}

export type ConfirmOutcome =
  | "paid" // confirmado agora
  | "already_paid"
  | "not_paid" // InfinitePay diz que ainda não pagou
  | "ignored" // pedido não existe / não é InfinitePay / loja sem config
  | "amount_mismatch" // valor do link diferente do pedido — não confirma
  | "error";

/**
 * Confere o pagamento na InfinitePay e, se aprovado com o valor certo,
 * confirma o pedido (baixa estoque, registra a taxa do cartão).
 * Usado pelo webhook e pela volta do cliente à página de confirmação.
 */
export async function verifyAndConfirm(
  db: SupabaseClient,
  ids: { storeId: string; orderNsu: string; transactionNsu: string; slug: string },
  fetchFn: FetchFn = fetch,
): Promise<ConfirmOutcome> {
  if (!ids.orderNsu || !ids.transactionNsu || !ids.slug) return "ignored";

  const { data: order } = await db
    .from("orders")
    .select("id, total, payment_provider, payment_status")
    .eq("id", ids.orderNsu)
    .eq("store_id", ids.storeId)
    .maybeSingle();
  if (!order || order.payment_provider !== "infinitepay") return "ignored";
  if (order.payment_status === "pago") return "already_paid";

  const config = await loadInfinitePayConfig(db, ids.storeId);
  if (!config) return "ignored";

  const result = await checkPayment(ids, config, fetchFn);
  if (!result.paid) return "not_paid";

  if (result.amount !== toCents(order.total)) {
    console.error(
      `[infinitepay] Valor não bate: link ${result.amount} × pedido ${toCents(order.total)} (centavos) — pedido ${order.id} NÃO confirmado.`,
    );
    return "amount_mismatch";
  }

  const { data, error } = await db.rpc("confirm_infinitepay_payment", {
    p_order_id: order.id,
    p_store_id: ids.storeId,
    p_transaction_nsu: ids.transactionNsu,
    p_capture_method: result.captureMethod ?? "credit_card",
    p_paid_amount: result.paidAmount / 100,
    p_installments: result.installments,
  });
  if (error || data?.success === false) {
    console.error("[infinitepay] Erro ao confirmar pagamento:", error ?? data);
    return "error";
  }
  if (data?.order_already_terminal) {
    console.error(
      `[infinitepay] Pedido ${order.id} já estava cancelado/rejeitado e foi PAGO — estornar pelo app da InfinitePay.`,
    );
  }
  return data?.already_paid ? "already_paid" : "paid";
}
