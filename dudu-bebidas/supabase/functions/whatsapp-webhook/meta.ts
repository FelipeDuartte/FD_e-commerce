// ─────────────────────────────────────────────────────────────
// Conversa com a Cloud API da Meta: conferir que o aviso veio mesmo da
// Meta (assinatura), enviar a resposta do robô e registrar falhas de
// entrega. Separado de _shared/whatsapp.ts de propósito: a notify-whatsapp
// (avisos de pedido) não é afetada por nada daqui.
// ─────────────────────────────────────────────────────────────

import type { BotReply } from "./bot.ts";

const META_API_VERSION = "v21.0";

const encoder = new TextEncoder();

/**
 * Confere o cabeçalho X-Hub-Signature-256 ("sha256=<hex>"): HMAC-SHA256 do
 * corpo cru com o App Secret do app da Meta. Sem isso, qualquer um que
 * soubesse o endereço da função podia forjar mensagens e fazer o robô
 * responder (gastando mensagens) para o número que quisesse.
 */
export async function isValidMetaSignature(
  rawBody: string,
  header: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!appSecret || !header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody)));
  const expected = Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
  const received = header.slice("sha256=".length).toLowerCase();
  if (received.length !== expected.length) return false;
  // Comparação em tempo constante
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  return diff === 0;
}

/** Converte a resposta do robô no formato de mensagem da Cloud API. */
export function toMetaMessage(reply: BotReply): Record<string, unknown> {
  switch (reply.type) {
    case "text":
      return { type: "text", text: { body: reply.body, preview_url: true } };
    case "buttons":
      return {
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: reply.body },
          action: { buttons: [{ type: "reply", reply: { id: "menu", title: "Ver menu" } }] },
        },
      };
    case "list":
      return {
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: reply.body },
          action: {
            button: reply.button,
            sections: [{ title: "Atendimento", rows: reply.rows }],
          },
        },
      };
  }
}

export async function sendReply(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  reply: BotReply,
): Promise<boolean> {
  try {
    const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        ...toMetaMessage(reply),
      }),
    });
    if (!res.ok) {
      console.error("[whatsapp-webhook] Falha ao responder", to, await res.json().catch(() => ({})));
    }
    return res.ok;
  } catch (err) {
    console.error("[whatsapp-webhook] Erro de rede ao responder:", err);
    return false;
  }
}

// Códigos de falha de entrega mais comuns, pra o log já dizer o que fazer.
const META_ERROR_HINTS: Record<number, string> = {
  131042: "problema de PAGAMENTO na conta do WhatsApp Business (Meta → Cobrança e pagamentos)",
  131049: "Meta limitou mensagens pra esse contato (comum em template de Marketing)",
  131026: "número não pode receber a mensagem (sem WhatsApp, bloqueou ou app desatualizado)",
  131047: "janela de 24h fechada — só template pode ser enviado",
  132015: "template PAUSADO por baixa qualidade",
  132016: "template DESATIVADO",
  131031: "conta do WhatsApp Business bloqueada/restrita",
};

interface MetaStatus {
  id?: string;
  status?: string;
  recipient_id?: string;
  errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[];
}

/**
 * A Cloud API responde "accepted" na hora do envio; a entrega real só é
 * confirmada depois, por este webhook. Falhas (status "failed") viram ERRO
 * no log com código e motivo — antes ficava em notify-whatsapp, que deixa
 * de receber estes avisos quando o webhook da Meta aponta pra cá.
 */
export function logDeliveryFailures(statuses: MetaStatus[], phoneNumberId: string): void {
  for (const st of statuses) {
    if (st.status !== "failed") continue;
    for (const err of st.errors?.length ? st.errors : [{}]) {
      const hint = err.code ? META_ERROR_HINTS[err.code] : undefined;
      console.error(
        `[whatsapp-webhook] FALHA NA ENTREGA → ${st.recipient_id ?? "?"}` +
          ` | código ${err.code ?? "?"}: ${err.title ?? err.message ?? "sem detalhe"}` +
          (hint ? ` | ${hint}` : "") +
          (err.error_data?.details ? ` | ${err.error_data.details}` : "") +
          ` | phone_number_id ${phoneNumberId} | msg ${st.id ?? "?"}`,
      );
    }
  }
}
