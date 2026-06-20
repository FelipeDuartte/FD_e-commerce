// ─────────────────────────────────────────────────────────────
// Helper compartilhado: envio de mensagens via WhatsApp Cloud API (Meta)
// Usado pela Edge Function "notify-whatsapp".
// ─────────────────────────────────────────────────────────────

const META_API_VERSION = "v21.0";

// Lidas das variáveis de ambiente (Supabase secrets) — configurar amanhã
// quando o número A (loja) estiver registrado e o token permanente gerado.
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "";
const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";

// Número B — celular do atendente que recebe o alerta de "novo pedido".
// Formato internacional sem espaços/símbolos, ex: 5531999999999
const ADMIN_ALERT_PHONE = Deno.env.get("WHATSAPP_ADMIN_ALERT_PHONE") ?? "";

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
  if (digits.length === 13 && digits.startsWith("55")) {
    return digits;
  }

  // Vem com código do país mas sem o 9º dígito (12 dígitos: 55 + DDD + 8 dígitos)
  if (digits.length === 12 && digits.startsWith("55")) {
    return digits;
  }

  // DDD + 9 dígitos (11 dígitos) — formato típico de celular BR sem código do país
  if (digits.length === 11) {
    return `55${digits}`;
  }

  // DDD + 8 dígitos (10 dígitos) — fixo ou celular antigo sem o 9
  if (digits.length === 10) {
    return `55${digits}`;
  }

  // Não foi possível normalizar com confiança
  return null;
}

/**
 * Envia uma mensagem de template via WhatsApp Cloud API.
 *
 * A Meta passou a exigir variáveis NOMEADAS nos templates (ex: {{customer_name}})
 * em vez do formato numérico antigo ({{1}}). Por isso os parâmetros do corpo
 * são passados como um objeto { nome_da_variavel: valor }, na mesma ordem/nomes
 * usados no texto do template aprovado no WhatsApp Manager.
 *
 * @param to Telefone de destino já normalizado (ex: "5531999450717")
 * @param templateName Nome exato do template aprovado no WhatsApp Manager
 * @param bodyParams Objeto com os valores de cada variável nomeada do corpo,
 *                    ex: { customer_name: "João", order_id: "A1B2C3D4" }
 * @param languageCode Código do idioma do template (default: pt_BR)
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  bodyParams: Record<string, string>,
  languageCode = "pt_BR",
): Promise<SendTemplateResult> {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.error(
      "[whatsapp] Variáveis WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID não configuradas ainda.",
    );
    return { ok: false, status: 0, body: { error: "missing_config" } };
  }

  const url = `https://graph.facebook.com/${META_API_VERSION}/${PHONE_NUMBER_ID}/messages`;

  const paramEntries = Object.entries(bodyParams);

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components:
        paramEntries.length > 0
          ? [
              {
                type: "body",
                parameters: paramEntries.map(([name, text]) => ({
                  type: "text",
                  parameter_name: name,
                  text,
                })),
              },
            ]
          : undefined,
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("[whatsapp] Falha ao enviar template:", templateName, "→", to, body);
    } else {
      console.log("[whatsapp] Template enviado:", templateName, "→", to);
    }

    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    console.error("[whatsapp] Erro de rede ao chamar a Cloud API:", err);
    return { ok: false, status: 0, body: { error: String(err) } };
  }
}

export function getAdminAlertPhone(): string | null {
  return ADMIN_ALERT_PHONE ? normalizePhoneBR(ADMIN_ALERT_PHONE) : null;
}
