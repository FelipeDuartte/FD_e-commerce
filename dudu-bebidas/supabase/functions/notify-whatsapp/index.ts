// ─────────────────────────────────────────────────────────────
// Edge Function: notify-whatsapp
//
// Recebe chamadas dos Database Webhooks do Supabase (tabela "orders")
// e dispara as mensagens de WhatsApp apropriadas via Cloud API da Meta.
//
// Eventos tratados:
//   INSERT  → avisa o atendente (Número B) que há um novo pedido pendente
//   UPDATE  → quando orders.status muda para preparing / rejected / on_the_way / delivered,
//             avisa o cliente final (Número A → cliente)
//
// Pedidos de retirada (address.isRetirada === true) NÃO recebem notificação
// de status (somente o alerta de novo pedido, igual aos de entrega).
// ─────────────────────────────────────────────────────────────

import {
  sendWhatsAppTemplate,
  normalizePhoneBR,
  getAdminAlertPhone,
} from "../_shared/whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Verify Token usado no handshake de verificação do Webhook da Meta.
// Precisa ser EXATAMENTE o mesmo valor preenchido no campo "Verificar token"
// em developers.facebook.com → seu app → WhatsApp → Configuração → Webhooks.
const META_WEBHOOK_VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") ?? "";

// Nomes dos templates — devem bater EXATAMENTE com os aprovados no WhatsApp Manager.
const TEMPLATES = {
  NOVO_PEDIDO: "novo_pedido",
  ACEITO: "pedido_aceito",
  REJEITADO: "pedido_rejeitado",
  SAIU_ENTREGA: "pedido_saiu_entrega",
  ENTREGUE: "pedido_entregue",
} as const;

// Status que disparam notificação ao CLIENTE (somente fluxo de entrega).
const CLIENT_NOTIFY_STATUS: Record<string, string> = {
  preparing: TEMPLATES.ACEITO,
  rejected: TEMPLATES.REJEITADO,
  on_the_way: TEMPLATES.SAIU_ENTREGA,
  delivered: TEMPLATES.ENTREGUE,
};

interface OrderRow {
  id: string;
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
}

interface DatabaseWebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: OrderRow | null;
  old_record: OrderRow | null;
  schema: string;
}

function formatOrderShortId(orderId: string): string {
  // Usa os 8 primeiros caracteres do UUID como número curto e legível.
  return orderId.slice(0, 8).toUpperCase();
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function handleNewOrder(order: OrderRow): Promise<Response> {
  const adminPhone = getAdminAlertPhone();

  if (!adminPhone) {
    console.error("[notify-whatsapp] WHATSAPP_ADMIN_ALERT_PHONE não configurado.");
    return new Response(
      JSON.stringify({ skipped: true, reason: "admin_phone_not_configured" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const customerName = order.address?.name ?? "Cliente";
  const shortId = formatOrderShortId(order.id);
  const total = formatCurrency(order.total ?? 0);
  const tipo = order.address?.isRetirada ? "Retirada" : "Entrega";

  const result = await sendWhatsAppTemplate(adminPhone, TEMPLATES.NOVO_PEDIDO, {
    customer_name: customerName,
    order_id: shortId,
    order_total: total,
    delivery_type: tipo,
  });

  return new Response(JSON.stringify({ event: "new_order", sent: result.ok, detail: result.body }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function handleStatusChange(
  order: OrderRow,
  oldOrder: OrderRow | null,
): Promise<Response> {
  // Evita disparo duplicado se o status não mudou de fato.
  if (oldOrder && oldOrder.status === order.status) {
    return new Response(JSON.stringify({ skipped: true, reason: "status_unchanged" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Pedidos de retirada não recebem notificação de status (somente o alerta de novo pedido).
  if (order.address?.isRetirada) {
    return new Response(JSON.stringify({ skipped: true, reason: "pickup_order" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const templateName = CLIENT_NOTIFY_STATUS[order.status];
  if (!templateName) {
    // Status sem template associado (ex: "pending") — nada a fazer.
    return new Response(JSON.stringify({ skipped: true, reason: "status_not_mapped" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const customerPhone = normalizePhoneBR(order.address?.phone);
  if (!customerPhone) {
    console.error("[notify-whatsapp] Telefone do cliente ausente/inválido. order_id:", order.id);
    return new Response(JSON.stringify({ skipped: true, reason: "invalid_customer_phone" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const customerName = order.address?.name ?? "Cliente";
  const shortId = formatOrderShortId(order.id);

  // Parâmetros do corpo variam por template — todos usam customer_name e order_id.
  // "pedido_aceito" tem uma terceira variável de tempo estimado (estimated_time).
  const bodyParams: Record<string, string> =
    templateName === TEMPLATES.ACEITO
      ? { customer_name: customerName, order_id: shortId, estimated_time: "30-40 minutos" }
      : { customer_name: customerName, order_id: shortId };

  const result = await sendWhatsAppTemplate(customerPhone, templateName, bodyParams);

  return new Response(
    JSON.stringify({ event: "status_change", status: order.status, sent: result.ok, detail: result.body }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

/**
 * Handshake de verificação do Webhook da Meta.
 * Quando você clica em "Verificar e salvar" no painel da Meta, ela faz uma
 * requisição GET com esses parâmetros — precisamos ecoar o "challenge" de volta
 * se o "verify_token" enviado bater com o nosso.
 * https://developers.facebook.com/docs/graph-api/webhooks/getting-started
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

/**
 * Trata webhooks recebidos DA META (mensagens de clientes, status de entrega,
 * aprovação de templates, etc). Por enquanto apenas loga — não há ação automática
 * configurada para esses eventos, já que o atendimento manual acontece pela
 * Meta Business Suite Inbox.
 */
function handleMetaWebhookEvent(payload: unknown): Response {
  console.log("[notify-whatsapp] Evento recebido da Meta:", JSON.stringify(payload));
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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

  // Handshake de verificação do Webhook da Meta (GET com hub.mode/hub.verify_token/hub.challenge)
  if (req.method === "GET") {
    return handleMetaVerification(req);
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();

    // Diferencia: isso veio do Database Webhook do Supabase (orders) ou
    // de um evento real da Meta (mensagem recebida / status de entrega)?
    if (!isSupabaseDatabaseWebhook(payload)) {
      return handleMetaWebhookEvent(payload);
    }

    if (payload.table !== "orders" || !payload.record) {
      return new Response(JSON.stringify({ skipped: true, reason: "not_orders_table" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payload.type === "INSERT") {
      return await handleNewOrder(payload.record);
    }

    if (payload.type === "UPDATE") {
      return await handleStatusChange(payload.record, payload.old_record);
    }

    return new Response(JSON.stringify({ skipped: true, reason: "event_type_not_handled" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[notify-whatsapp] Erro inesperado:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
