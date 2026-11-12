// Aviso de pagamento da InfinitePay (configurado em cada link criado por
// infinitepay-checkout, com ?store_id= da loja).
//
// O aviso não tem assinatura: o corpo só serve pra saber QUAL pagamento
// conferir — a confirmação vem do /payment_check com a chave da loja.
// Responde 200 na hora (a InfinitePay pede < 1s) e confere em segundo
// plano; se falhar, a volta do cliente à página de confirmação confere de
// novo (infinitepay-checkout, action "check").

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse as baseJsonResponse } from "../_shared/http.ts";
import { verifyAndConfirm } from "../_shared/infinitepay.ts";

export interface InfinitePayWebhookDeps {
  serviceClient(): SupabaseClient;
  /** Roda depois de responder (EdgeRuntime.waitUntil no Deno). */
  background(task: Promise<unknown>): void;
  fetchFn?: typeof fetch;
}

// Chamada servidor→servidor, sem CORS
const jsonResponse = (body: unknown, status = 200) => baseJsonResponse(body, status, {});

export async function handleInfinitePayWebhook(req: Request, deps: InfinitePayWebhookDeps): Promise<Response> {
  if (req.method !== "POST") return jsonResponse({ received: true });

  const storeId = new URL(req.url).searchParams.get("store_id");
  const body = await req.json().catch(() => ({}));
  const ids = {
    storeId: storeId ?? "",
    orderNsu: String(body?.order_nsu ?? ""),
    transactionNsu: String(body?.transaction_nsu ?? ""),
    slug: String(body?.invoice_slug ?? body?.slug ?? ""),
  };

  if (!storeId || !ids.orderNsu || !ids.transactionNsu || !ids.slug) {
    console.error("[infinitepay-webhook] Aviso incompleto — ignorado.", JSON.stringify({ storeId, ...ids }));
    return jsonResponse({ received: true });
  }

  deps.background(
    verifyAndConfirm(deps.serviceClient(), ids, deps.fetchFn)
      .then((outcome) => console.log(`[infinitepay-webhook] Pedido ${ids.orderNsu}: ${outcome}`))
      .catch((err) => console.error("[infinitepay-webhook] Erro ao conferir:", err)),
  );
  return jsonResponse({ received: true });
}
