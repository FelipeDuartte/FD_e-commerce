// ─────────────────────────────────────────────────────────────
// Edge Function: notify-whatsapp  (MULTI-LOJA)
//
// Recebe chamadas dos Database Webhooks do Supabase (tabela "orders")
// e dispara as mensagens de WhatsApp apropriadas via Cloud API da Meta.
//
// Eventos tratados:
//   INSERT  → avisa o atendente (Número B) que há um novo pedido pendente
//   UPDATE  → quando orders.status muda para preparing / rejected /
//             on_the_way / delivered, avisa o cliente final
//
// MULTI-LOJA: o Database Webhook dispara para pedidos de TODAS as lojas
// (ele é por tabela, não por loja). Quem separa é esta function: a
// configuração de WhatsApp — número, token e templates — é resolvida a
// partir de `order.store_id` na tabela `whatsapp_configs`.
//
// Loja sem linha em whatsapp_configs NÃO notifica ninguém. Antes, a config
// vinha de variáveis de ambiente globais, então um pedido da Loja B
// disparava mensagem pelo número da Loja A para o atendente da Loja A.
//
// Pedidos de retirada (address.isRetirada === true) NÃO recebem notificação
// de status (somente o alerta de novo pedido, igual aos de entrega).
// ─────────────────────────────────────────────────────────────

import {
  sendWhatsAppTemplate,
  normalizePhoneBR,
  getStoreWhatsAppConfig,
  type StoreWhatsAppConfig,
} from "../_shared/whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Verify Token usado no handshake de verificação do Webhook da Meta.
// Precisa ser EXATAMENTE o mesmo valor preenchido no campo "Verificar token"
// em developers.facebook.com → seu app → WhatsApp → Configuração → Webhooks.
const META_WEBHOOK_VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") ?? "";

// Segredo compartilhado entre os triggers do banco (orders → notify-whatsapp-*)
// e esta function. `verify_jwt = false` é obrigatório aqui (Meta e o Database
// Webhook do Supabase não mandam um JWT de usuário), então SEM isso qualquer
// pessoa podia forjar um POST com formato de Database Webhook e disparar
// mensagens de WhatsApp (custo + spam) pro número que quiser.
const WEBHOOK_SHARED_SECRET = Deno.env.get("WEBHOOK_SHARED_SECRET") ?? "";

interface OrderRow {
  id: string;
  store_id: string;
  order_number: number;
  total: number;
  payment_method: string;
  address: {
    name?: string;
    phone?: string;
    isRetirada?: boolean;
    [key: string]: unknown;
  } | null;
  status: string;
  created_at: string;
  channel: string;
  payment_status?: string;
  payment_provider?: string | null;
}

/**
 * Pagamento online (InfinitePay) ainda não pago: o cliente pode nem pagar —
 * a loja só é avisada quando o pagamento confirmar (ver UPDATE abaixo).
 */
function isUnpaidOnlineOrder(order: OrderRow): boolean {
  return order.payment_provider === "infinitepay" && order.payment_status !== "pago";
}

interface DatabaseWebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: OrderRow | null;
  old_record: OrderRow | null;
  schema: string;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Status que disparam notificação ao CLIENTE, mapeados pros templates da loja. */
function clientTemplateFor(status: string, config: StoreWhatsAppConfig): string | null {
  switch (status) {
    case "preparing":
      return config.templates.orderAccepted;
    case "rejected":
      return config.templates.orderRejected;
    case "on_the_way":
      return config.templates.outForDelivery;
    case "delivered":
      return config.templates.delivered;
    default:
      return null;
  }
}

async function handleNewOrder(order: OrderRow): Promise<Response> {
  const config = await getStoreWhatsAppConfig(order.store_id);
  if (!config) {
    return jsonResponse({ skipped: true, reason: "whatsapp_not_configured_for_store" });
  }

  if (!config.adminAlertPhone) {
    console.error(
      `[notify-whatsapp] Loja ${order.store_id} sem admin_alert_phone em whatsapp_configs.`,
    );
    return jsonResponse({ skipped: true, reason: "admin_phone_not_configured" });
  }

  const customerName = order.address?.name ?? "Cliente";
  const shortId = String(order.order_number);
  const total = formatCurrency(order.total ?? 0);
  const tipo = order.address?.isRetirada ? "Retirada" : "Entrega";

  const result = await sendWhatsAppTemplate(
    config,
    config.adminAlertPhone,
    config.templates.orderCreated,
    {
      customer_name: customerName,
      order_id: shortId,
      order_total: total,
      delivery_type: tipo,
    },
  );

  return jsonResponse({ event: "new_order", sent: result.ok, detail: result.body });
}

async function handleStatusChange(
  order: OrderRow,
  oldOrder: OrderRow | null,
): Promise<Response> {
  // Evita disparo duplicado se o status não mudou de fato.
  if (oldOrder && oldOrder.status === order.status) {
    return jsonResponse({ skipped: true, reason: "status_unchanged" });
  }

  // Pedidos de retirada não recebem notificação de status (somente o alerta
  // de novo pedido).
  if (order.address?.isRetirada) {
    return jsonResponse({ skipped: true, reason: "pickup_order" });
  }

  const config = await getStoreWhatsAppConfig(order.store_id);
  if (!config) {
    return jsonResponse({ skipped: true, reason: "whatsapp_not_configured_for_store" });
  }

  const templateName = clientTemplateFor(order.status, config);
  if (!templateName) {
    // Status sem template associado (ex: "pending") — nada a fazer.
    return jsonResponse({ skipped: true, reason: "status_not_mapped" });
  }

  const customerPhone = normalizePhoneBR(order.address?.phone);
  if (!customerPhone) {
    console.error(
      "[notify-whatsapp] Telefone do cliente ausente/inválido. order_id:",
      order.id,
    );
    return jsonResponse({ skipped: true, reason: "invalid_customer_phone" });
  }

  const customerName = order.address?.name ?? "Cliente";
  const shortId = String(order.order_number);

  // Parâmetros do corpo variam por template — todos usam customer_name e
  // order_id. O de "pedido aceito" tem uma terceira variável de tempo.
  const bodyParams: Record<string, string> =
    order.status === "preparing"
      ? { customer_name: customerName, order_id: shortId, estimated_time: "30-40 minutos" }
      : { customer_name: customerName, order_id: shortId };

  const result = await sendWhatsAppTemplate(config, customerPhone, templateName, bodyParams);

  return jsonResponse({
    event: "status_change",
    status: order.status,
    sent: result.ok,
    detail: result.body,
  });
}

/**
 * Handshake de verificação do Webhook da Meta.
 * Quando você clica em "Verificar e salvar" no painel da Meta, ela faz uma
 * requisição GET com esses parâmetros — precisamos ecoar o "challenge" de
 * volta se o "verify_token" enviado bater com o nosso.
 */
function handleMetaVerification(req: Request): Response {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === META_WEBHOOK_VERIFY_TOKEN && challenge) {
    console.log("[notify-whatsapp] Webhook da Meta verificado com sucesso.");
    return new Response(challenge, { status: 200 });
  }

  console.error("[notify-whatsapp] Falha na verificação do webhook da Meta (token não confere).");
  return new Response("Forbidden", { status: 403 });
}

interface MetaStatusError {
  code?: number;
  title?: string;
  message?: string;
  error_data?: { details?: string };
}

interface MetaStatus {
  id?: string;
  status?: string;
  recipient_id?: string;
  errors?: MetaStatusError[];
}

// Códigos de falha mais comuns, pra o log já dizer o que fazer.
const META_ERROR_HINTS: Record<number, string> = {
  131042: "problema de PAGAMENTO na conta do WhatsApp Business (Meta → Cobrança e pagamentos)",
  131049: "Meta limitou mensagens pra esse contato (comum em template de Marketing)",
  131026: "número não pode receber a mensagem (sem WhatsApp, bloqueou ou app desatualizado)",
  131047: "janela de 24h fechada — só template pode ser enviado",
  132015: "template PAUSADO por baixa qualidade",
  132016: "template DESATIVADO",
  131031: "conta do WhatsApp Business bloqueada/restrita",
};

/**
 * Trata webhooks recebidos DA META (mensagens de clientes, status de entrega,
 * aprovação de templates, etc).
 *
 * A Cloud API responde "accepted" na hora do envio, mas a entrega real só é
 * confirmada depois, por aqui. Por isso falhas de entrega (status "failed")
 * são logadas como ERRO com código e motivo — sem isso uma conta com
 * pagamento atrasado parava todas as mensagens sem nenhum erro visível.
 */
function handleMetaWebhookEvent(payload: unknown): Response {
  // deno-lint-ignore no-explicit-any
  const entries = (payload as any)?.entry ?? [];
  let failures = 0;

  for (const entry of Array.isArray(entries) ? entries : []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value ?? {};
      const phoneNumberId = value?.metadata?.phone_number_id ?? "?";
      const statuses: MetaStatus[] = value?.statuses ?? [];

      for (const st of statuses) {
        if (st.status !== "failed") continue;
        failures++;
        for (const err of st.errors?.length ? st.errors : [{}]) {
          const hint = err.code ? META_ERROR_HINTS[err.code] : undefined;
          console.error(
            `[notify-whatsapp] FALHA NA ENTREGA → ${st.recipient_id ?? "?"}` +
              ` | código ${err.code ?? "?"}: ${err.title ?? err.message ?? "sem detalhe"}` +
              (hint ? ` | ${hint}` : "") +
              (err.error_data?.details ? ` | ${err.error_data.details}` : "") +
              ` | phone_number_id ${phoneNumberId} | msg ${st.id ?? "?"}`,
          );
        }
      }
    }
  }

  if (failures === 0) {
    console.log("[notify-whatsapp] Evento recebido da Meta:", JSON.stringify(payload));
  }
  return jsonResponse({ received: true });
}

function isSupabaseDatabaseWebhook(payload: unknown): payload is DatabaseWebhookPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "table" in payload &&
    "type" in payload &&
    "record" in payload
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Handshake de verificação do Webhook da Meta
  if (req.method === "GET") {
    return handleMetaVerification(req);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  try {
    const payload = await req.json();

    // Diferencia: isso veio do Database Webhook do Supabase (orders) ou
    // de um evento real da Meta (mensagem recebida / status de entrega)?
    if (!isSupabaseDatabaseWebhook(payload)) {
      return handleMetaWebhookEvent(payload);
    }

    // Só o trigger do banco conhece esse segredo. Sem essa checagem,
    // qualquer um podia forjar um payload com essa forma e disparar
    // mensagem de WhatsApp real.
    const providedSecret = req.headers.get("x-webhook-secret");
    if (!WEBHOOK_SHARED_SECRET || providedSecret !== WEBHOOK_SHARED_SECRET) {
      console.error("[notify-whatsapp] x-webhook-secret ausente/inválido — payload rejeitado.");
      return jsonResponse({ error: "forbidden" }, 403);
    }

    if (payload.table !== "orders" || !payload.record) {
      return jsonResponse({ skipped: true, reason: "not_orders_table" });
    }

    // Venda de balcão (PDV) — o admin acabou de registrar em pessoa, não faz
    // sentido notificar o WhatsApp do próprio admin sobre isso.
    if (payload.record.channel === "balcao") {
      return jsonResponse({ skipped: true, reason: "balcao_sale" });
    }

    if (payload.type === "INSERT") {
      if (isUnpaidOnlineOrder(payload.record)) {
        return jsonResponse({ skipped: true, reason: "online_payment_pending" });
      }
      return await handleNewOrder(payload.record);
    }

    if (payload.type === "UPDATE") {
      // Pagamento online acabou de ser confirmado: agora sim é pedido novo
      if (
        payload.record.payment_provider === "infinitepay" &&
        payload.record.payment_status === "pago" &&
        payload.old_record?.payment_status !== "pago"
      ) {
        return await handleNewOrder(payload.record);
      }
      return await handleStatusChange(payload.record, payload.old_record);
    }

    return jsonResponse({ skipped: true, reason: "event_type_not_handled" });
  } catch (err) {
    console.error("[notify-whatsapp] Erro inesperado:", err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});