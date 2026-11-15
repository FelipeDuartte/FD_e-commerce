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
//
// Só envia. Mensagens dos clientes e status de entrega da Meta chegam na
// edge function whatsapp-webhook (endereço do webhook no app da Meta).
// ─────────────────────────────────────────────────────────────

import {
  sendWhatsAppTemplate,
  isParameterMismatch,
  normalizePhoneBR,
  getStoreWhatsAppConfig,
  type StoreWhatsAppConfig,
} from "../_shared/whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Segredo compartilhado entre os triggers do banco (orders → notify-whatsapp-*)
// e esta function. `verify_jwt = false` é obrigatório aqui (o Database
// Webhook do Supabase não manda um JWT de usuário), então SEM isso qualquer
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

  // "Saiu para entrega": botão "Acompanhar pedido" com o link do pedido
  // (/confirmacao?pedido=<código>). Se o template ainda não tem o botão
  // aprovado, a Meta recusa o parâmetro a mais — aí reenvia sem ele, pra o
  // aviso nunca deixar de sair.
  const urlButtonParam = order.status === "on_the_way" ? order.id : undefined;
  let result = await sendWhatsAppTemplate(config, customerPhone, templateName, bodyParams, { urlButtonParam });
  if (!result.ok && urlButtonParam && isParameterMismatch(result.body)) {
    console.warn(`[notify-whatsapp] Template ${templateName} sem o botão de link aprovado — reenviando sem o link.`);
    result = await sendWhatsAppTemplate(config, customerPhone, templateName, bodyParams);
  }

  return jsonResponse({
    event: "status_change",
    status: order.status,
    sent: result.ok,
    detail: result.body,
  });
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

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  try {
    const payload = await req.json();

    // Só aceita o formato do Database Webhook do Supabase (orders)
    if (!isSupabaseDatabaseWebhook(payload)) {
      return jsonResponse({ skipped: true, reason: "not_database_webhook" }, 400);
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