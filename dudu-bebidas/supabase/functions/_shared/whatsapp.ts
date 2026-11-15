// ─────────────────────────────────────────────────────────────
// Helper compartilhado: envio de mensagens via WhatsApp Cloud API (Meta)
// Usado pela Edge Function "notify-whatsapp".
//
// MULTI-LOJA
// Antes, token/phone_number_id/telefone do atendente vinham de variáveis
// de ambiente — um valor só para o projeto inteiro. Com mais de uma loja no
// mesmo Supabase isso vazava: um pedido da Loja B disparava mensagem pelo
// número da Loja A, para o atendente da Loja A.
//
// Agora cada loja tem sua linha em `whatsapp_configs` (PK = store_id) e a
// configuração é resolvida por pedido. Loja sem linha simplesmente não
// notifica — nunca cai no número de outra.
// ─────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const META_API_VERSION = "v21.0";

export interface StoreWhatsAppConfig {
  storeId: string;
  phoneNumberId: string;
  accessToken: string;
  adminAlertPhone: string | null;
  templates: {
    orderCreated: string;
    orderAccepted: string;
    orderRejected: string;
    outForDelivery: string;
    delivered: string;
  };
}

export interface SendTemplateResult {
  ok: boolean;
  status: number;
  body: unknown;
}

/**
 * Converte um telefone brasileiro em qualquer formato comum
 * ("(31) 99945-0717", "31999450717", "+55 31 99945-0717")
 * para o formato internacional exigido pela API: "5531999450717".
 *
 * Retorna null se não for possível extrair um número válido.
 */
export function normalizePhoneBR(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // Já vem com código do país (13 dígitos: 55 + DDD + 9 dígitos)
  if (digits.length === 13 && digits.startsWith("55")) return digits;

  // Vem com código do país mas sem o 9º dígito (12 dígitos)
  if (digits.length === 12 && digits.startsWith("55")) return digits;

  // DDD + 9 dígitos — celular BR sem código do país
  if (digits.length === 11) return `55${digits}`;

  // DDD + 8 dígitos — fixo ou celular antigo sem o 9
  if (digits.length === 10) return `55${digits}`;

  // Não foi possível normalizar com confiança
  return null;
}

/**
 * Busca a configuração de WhatsApp DA LOJA do pedido.
 *
 * Retorna null quando a loja não tem WhatsApp configurado — e nesse caso o
 * certo é NÃO notificar ninguém. Cair num número global aqui foi exatamente
 * o bug que fazia pedido de uma loja tocar o telefone da outra.
 */
export async function getStoreWhatsAppConfig(
  storeId: string | null | undefined,
): Promise<StoreWhatsAppConfig | null> {
  if (!storeId) {
    console.error("[whatsapp] Pedido sem store_id — nada a notificar.");
    return null;
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase
    .from("whatsapp_configs")
    .select(
      "phone_number_id, access_token, admin_alert_phone, " +
        "template_order_created, template_order_accepted, template_order_rejected, " +
        "template_out_for_delivery, template_delivered",
    )
    .eq("store_id", storeId)
    .maybeSingle();

  if (error) {
    console.error("[whatsapp] Erro ao buscar whatsapp_configs:", error);
    return null;
  }

  if (!data?.phone_number_id || !data?.access_token) {
    console.log(
      `[whatsapp] Loja ${storeId} sem WhatsApp configurado — notificação ignorada.`,
    );
    return null;
  }

  return {
    storeId,
    phoneNumberId: data.phone_number_id,
    accessToken: data.access_token,
    adminAlertPhone: normalizePhoneBR(data.admin_alert_phone),
    templates: {
      orderCreated: data.template_order_created,
      orderAccepted: data.template_order_accepted,
      orderRejected: data.template_order_rejected,
      outForDelivery: data.template_out_for_delivery,
      delivered: data.template_delivered,
    },
  };
}

/**
 * Envia uma mensagem de template via WhatsApp Cloud API, usando as
 * credenciais DA LOJA (config) — não mais variáveis de ambiente globais.
 *
 * A Meta exige variáveis NOMEADAS nos templates (ex: {{customer_name}}), por
 * isso os parâmetros do corpo vão como objeto { nome_da_variavel: valor },
 * com os mesmos nomes usados no template aprovado no WhatsApp Manager.
 *
 * @param config Configuração da loja (ver getStoreWhatsAppConfig)
 * @param to Telefone de destino já normalizado (ex: "5531999450717")
 * @param templateName Nome exato do template aprovado no WhatsApp Manager
 * @param bodyParams Valores de cada variável nomeada do corpo
 * @param options Idioma (default pt_BR) e o final do link do botão de URL
 */
export interface TemplateOptions {
  languageCode?: string;
  /**
   * Final do link de um botão de URL dinâmica do template — ex: o código do
   * pedido em ".../confirmacao?pedido={{1}}". O botão precisa ser o 1º do
   * template (índice 0).
   */
  urlButtonParam?: string;
}

/** Corpo da chamada à Cloud API (separado pra ser testado). */
export function buildTemplatePayload(
  to: string,
  templateName: string,
  bodyParams: Record<string, string>,
  { languageCode = "pt_BR", urlButtonParam }: TemplateOptions = {},
) {
  const paramEntries = Object.entries(bodyParams);
  const components: Record<string, unknown>[] = [];
  if (paramEntries.length > 0) {
    components.push({
      type: "body",
      parameters: paramEntries.map(([name, text]) => ({ type: "text", parameter_name: name, text })),
    });
  }
  if (urlButtonParam) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: urlButtonParam }],
    });
  }
  return {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: components.length ? components : undefined,
    },
  };
}

// Erros da Meta quando os parâmetros enviados não batem com o template
// aprovado (ex: mandou o código do botão, mas o template ainda não tem o
// botão aprovado).
const PARAMETER_MISMATCH_CODES = new Set([100, 131008, 131009, 132000, 132012]);

export function isParameterMismatch(body: unknown): boolean {
  // deno-lint-ignore no-explicit-any
  const code = (body as any)?.error?.code;
  return typeof code === "number" && PARAMETER_MISMATCH_CODES.has(code);
}

export async function sendWhatsAppTemplate(
  config: StoreWhatsAppConfig,
  to: string,
  templateName: string,
  bodyParams: Record<string, string>,
  options: TemplateOptions = {},
): Promise<SendTemplateResult> {
  const url = `https://graph.facebook.com/${META_API_VERSION}/${config.phoneNumberId}/messages`;
  const payload = buildTemplatePayload(to, templateName, bodyParams, options);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error(
        "[whatsapp] Falha ao enviar template:",
        templateName,
        "→",
        to,
        `(loja ${config.storeId})`,
        body,
      );
    } else {
      console.log(
        "[whatsapp] Template enviado:",
        templateName,
        "→",
        to,
        `(loja ${config.storeId})`,
      );
    }

    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    console.error("[whatsapp] Erro de rede ao chamar a Cloud API:", err);
    return { ok: false, status: 0, body: { error: String(err) } };
  }
}