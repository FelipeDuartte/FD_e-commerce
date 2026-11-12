// Pagamento online pela InfinitePay, chamado pelo site:
//   action "create": cria (ou devolve) o link de pagamento do pedido
//   action "check":  na volta do cliente, confere na InfinitePay e confirma
// Quem sabe o código (UUID) do pedido consegue chamar — mesmo modelo do
// pix-charge/cancel_order. Nada daqui confirma pagamento sem a InfinitePay
// dizer que foi pago (ver _shared/infinitepay.ts).

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/http.ts";
import {
  buildLinkPayload,
  createPaymentLink,
  InfinitePayError,
  LINK_VALIDITY_MINUTES,
  loadInfinitePayConfig,
  verifyAndConfirm,
} from "../_shared/infinitepay.ts";

export interface InfinitePayCheckoutDeps {
  serviceClient(): SupabaseClient;
  /** URL pública das edge functions (…/functions/v1) — pro aviso da InfinitePay. */
  functionsBaseUrl: string;
  fetchFn?: typeof fetch;
  now?: () => Date;
}

export async function handleInfinitePayCheckout(req: Request, deps: InfinitePayCheckoutDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const now = deps.now ?? (() => new Date());

  try {
    const { action = "create", orderId, storeId, transactionNsu, slug } = await req.json();
    if (!orderId || !storeId) {
      return jsonResponse({ error: "orderId e storeId são obrigatórios." }, 400);
    }
    const db = deps.serviceClient();

    if (action === "check") {
      const outcome = await verifyAndConfirm(
        db,
        { storeId, orderNsu: orderId, transactionNsu, slug },
        deps.fetchFn,
      );
      return jsonResponse({ status: outcome, paid: outcome === "paid" || outcome === "already_paid" });
    }

    const { data: order } = await db
      .from("orders")
      .select("id, order_number, total, address, status, payment_provider, payment_status, payment_link_url, created_at")
      .eq("id", orderId)
      .eq("store_id", storeId)
      .maybeSingle();

    if (!order || order.payment_provider !== "infinitepay") {
      return jsonResponse({ error: "Pedido não encontrado." }, 404);
    }
    if (order.payment_status === "pago") {
      return jsonResponse({ paid: true });
    }
    if (order.status !== "pending") {
      return jsonResponse({ error: "Este pedido não está mais aguardando pagamento." }, 400);
    }
    const ageMs = now().getTime() - new Date(order.created_at).getTime();
    if (ageMs > LINK_VALIDITY_MINUTES * 60_000) {
      return jsonResponse({ error: "O prazo para pagar este pedido acabou. Faça o pedido de novo." }, 410);
    }
    // Um link só por pedido: clicar de novo devolve o mesmo (nunca dá pra
    // pagar duas vezes)
    if (order.payment_link_url) {
      return jsonResponse({ url: order.payment_link_url });
    }
    const config = await loadInfinitePayConfig(db, storeId);
    if (!config) {
      return jsonResponse({ error: "Esta loja ainda não configurou o pagamento online." }, 400);
    }

    const [{ data: items }, { data: store }] = await Promise.all([
      db.from("order_items").select("name, price, quantity").eq("order_id", order.id),
      db.from("stores").select("site_url").eq("id", storeId).maybeSingle(),
    ]);

    const payload = buildLinkPayload({
      order,
      items: items ?? [],
      config,
      siteUrl: store?.site_url ?? null,
      webhookUrl: `${deps.functionsBaseUrl}/infinitepay-webhook?store_id=${storeId}`,
      // O link vence junto com o pedido (30 min contados da criação)
      now: new Date(order.created_at),
    });
    const url = await createPaymentLink(payload, config, deps.fetchFn);

    await db.from("orders").update({ payment_link_url: url }).eq("id", order.id).eq("store_id", storeId);
    return jsonResponse({ url });
  } catch (err) {
    if (err instanceof InfinitePayError) return jsonResponse({ error: err.message }, 400);
    console.error("[infinitepay-checkout] Erro inesperado:", err);
    return jsonResponse({ error: "Não foi possível iniciar o pagamento online." }, 500);
  }
}
