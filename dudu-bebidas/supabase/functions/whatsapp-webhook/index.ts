// ─────────────────────────────────────────────────────────────
// Edge Function: whatsapp-webhook
//
// Endereço do webhook do app da Meta (WhatsApp → Configuração → Webhooks).
// Recebe as mensagens que os clientes mandam para o número da loja e
// responde com o chatbot de atendimento (bot.ts). Também registra falhas
// de entrega das mensagens enviadas (avisos de pedido).
//
// Multi-loja: cada aviso vem com o phone_number_id do número que recebeu a
// mensagem; a loja é achada em whatsapp_configs por esse id. Número sem
// loja cadastrada é ignorado (nunca responde com dados de outra loja).
//
// Segredos (Supabase → Edge Functions → Secrets):
//   META_APP_SECRET           App Secret do app da Meta (confere a assinatura)
//   META_WEBHOOK_VERIFY_TOKEN mesmo valor do campo "Verificar token" na Meta
// ─────────────────────────────────────────────────────────────

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { type BotData, type BotInput, buildReply } from "./bot.ts";
import { isValidMetaSignature, logDeliveryFailures, sendReply } from "./meta.ts";

const APP_SECRET = Deno.env.get("META_APP_SECRET") ?? "";
const VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") ?? "";

// Contra abuso: acima disso o robô para de responder aquele telefone por 1h.
const MAX_MESSAGES_PER_HOUR = 20;
const RETENTION_DAYS = 30;
const ORDER_LOOKBACK_DAYS = 2;

const ok = () => new Response(JSON.stringify({ received: true }), {
  status: 200,
  headers: { "Content-Type": "application/json" },
});

// deno-lint-ignore no-explicit-any
type Json = any;

interface StoreConn {
  storeId: string;
  phoneNumberId: string;
  accessToken: string;
}

function inputFrom(message: Json): BotInput {
  switch (message?.type) {
    case "text":
      return { kind: "text", text: String(message.text?.body ?? "") };
    case "interactive": {
      const id = message.interactive?.list_reply?.id ?? message.interactive?.button_reply?.id;
      return id ? { kind: "choice", id: String(id) } : { kind: "other" };
    }
    case "button": // resposta rápida de um template
      return { kind: "text", text: String(message.button?.text ?? "") };
    default: // áudio, imagem, figurinha, localização...
      return { kind: "other", media: String(message?.type ?? "") };
  }
}

/** Busca paginada — o Supabase devolve no máximo 1000 linhas por vez. */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < 10; page++) {
    const { data } = await build(page * 1000, page * 1000 + 999);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function loadBotData(db: SupabaseClient, storeId: string): Promise<BotData | null> {
  const { data: store } = await db
    .from("stores")
    .select("name, whatsapp, pickup_address, pickup_address_detail, site_url, is_active")
    .eq("id", storeId)
    .maybeSingle();
  if (!store?.is_active) return null;

  // Sob demanda e uma vez só por mensagem (horário e entrega usam a mesma config)
  const once = <T>(load: () => Promise<T>) => {
    let cached: Promise<T> | null = null;
    return () => (cached ??= load());
  };

  return {
    store: {
      name: store.name,
      whatsapp: store.whatsapp,
      pickupAddress: store.pickup_address,
      pickupAddressDetail: store.pickup_address_detail,
      siteUrl: store.site_url,
    },
    hours: once(async () =>
      (await db.from("store_hours").select("day_of_week, is_open, open_time, close_time").eq("store_id", storeId))
        .data ?? []
    ),
    config: once(async () =>
      (await db
        .from("store_config")
        .select("close_on_holidays, free_shipping_threshold, payment_methods_enabled")
        .eq("store_id", storeId)
        .maybeSingle()).data
    ),
    zones: once(async () =>
      (await db
        .from("delivery_zones")
        .select("nome, frete, is_retirada")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .order("sort_order")).data ?? []
    ),
    // Só o que a vitrine mostra: ativo, no site e não arquivado. Nunca custo.
    products: once(() =>
      fetchAll((from, to) =>
        db
          .from("products")
          .select("name, price, old_price, promotion, stock, category")
          .eq("store_id", storeId)
          .eq("is_active", true)
          .eq("show_on_site", true)
          .is("deleted_at", null)
          .order("id")
          .range(from, to)
      )
    ),
    recentOrders: once(async () => {
      const since = new Date(Date.now() - ORDER_LOOKBACK_DAYS * 86_400_000).toISOString();
      return (await db
        .from("orders")
        .select("order_number, status, total, created_at, address")
        .eq("store_id", storeId)
        .neq("channel", "balcao")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500)).data ?? [];
    }),
  };
}

/** Registra a mensagem. false = já processada (a Meta reenvia avisos). */
async function registerMessage(db: SupabaseClient, conn: StoreConn, message: Json, from: string): Promise<boolean> {
  const { error } = await db.from("whatsapp_inbound_messages").insert({
    message_id: message.id,
    store_id: conn.storeId,
    phone: from,
    kind: ["text", "interactive"].includes(message.type) ? message.type : "outro",
  });
  if (error?.code === "23505") return false; // repetida
  if (error) console.error("[whatsapp-webhook] Erro ao registrar mensagem:", error);
  return true;
}

async function overRateLimit(db: SupabaseClient, conn: StoreConn, from: string): Promise<boolean> {
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count } = await db
    .from("whatsapp_inbound_messages")
    .select("message_id", { count: "exact", head: true })
    .eq("store_id", conn.storeId)
    .eq("phone", from)
    .gte("received_at", since);
  return (count ?? 0) > MAX_MESSAGES_PER_HOUR;
}

async function handleMessage(db: SupabaseClient, conn: StoreConn, message: Json): Promise<void> {
  const from = String(message?.from ?? "");
  if (!message?.id || !from) return;

  if (!(await registerMessage(db, conn, message, from))) return;
  if (await overRateLimit(db, conn, from)) {
    console.warn(`[whatsapp-webhook] Limite por hora atingido: ${from} (loja ${conn.storeId})`);
    return;
  }

  const data = await loadBotData(db, conn.storeId);
  if (!data) return;

  const reply = await buildReply(inputFrom(message), data, from);
  await sendReply(conn.phoneNumberId, conn.accessToken, replyAddress(from), reply);
}

/**
 * O WhatsApp entrega celulares brasileiros SEM o 9º dígito (553199450717),
 * mas a lista de números permitidos do número de teste — e o cadastro de
 * muitos contatos — usa o número com o 9 (5531999450717), e a Meta recusa
 * (erro 131030). Celular BR com 12 dígitos (começa com 6–9 depois do DDD)
 * ganha o 9 de volta; fixo (2–5) fica como veio.
 */
export function replyAddress(from: string): string {
  return /^55\d{2}[6-9]\d{7}$/.test(from) ? `${from.slice(0, 4)}9${from.slice(4)}` : from;
}

async function findStore(db: SupabaseClient, phoneNumberId: string): Promise<StoreConn | null> {
  const { data } = await db
    .from("whatsapp_configs")
    .select("store_id, access_token")
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();
  if (!data?.access_token) return null;
  return { storeId: data.store_id, phoneNumberId, accessToken: data.access_token };
}

Deno.serve(async (req) => {
  // Handshake da Meta ao salvar o webhook ("Verificar e salvar")
  if (req.method === "GET") {
    const url = new URL(req.url);
    const challenge = url.searchParams.get("hub.challenge");
    if (
      url.searchParams.get("hub.mode") === "subscribe" &&
      VERIFY_TOKEN &&
      url.searchParams.get("hub.verify_token") === VERIFY_TOKEN &&
      challenge
    ) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawBody = await req.text();
  if (!(await isValidMetaSignature(rawBody, req.headers.get("x-hub-signature-256"), APP_SECRET))) {
    console.error("[whatsapp-webhook] Assinatura inválida ou META_APP_SECRET ausente — aviso ignorado.");
    return new Response("Forbidden", { status: 403 });
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const payload = JSON.parse(rawBody);
    for (const entry of payload?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value ?? {};
        const phoneNumberId = String(value?.metadata?.phone_number_id ?? "");
        logDeliveryFailures(value?.statuses ?? [], phoneNumberId || "?");

        const messages = value?.messages ?? [];
        if (!messages.length) continue;

        const conn = phoneNumberId ? await findStore(db, phoneNumberId) : null;
        if (!conn) {
          console.warn(`[whatsapp-webhook] Número ${phoneNumberId || "?"} sem loja em whatsapp_configs — ignorado.`);
          continue;
        }
        for (const message of messages) await handleMessage(db, conn, message);
      }
    }

    // Limpeza ocasional do registro (LGPD) — ~1 a cada 50 avisos
    if (Math.random() < 0.02) {
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
      await db.from("whatsapp_inbound_messages").delete().lt("received_at", cutoff);
    }
  } catch (err) {
    // Responde 200 mesmo assim: um reenvio da Meta seria ignorado como repetido.
    console.error("[whatsapp-webhook] Erro inesperado:", err);
  }

  return ok();
});
