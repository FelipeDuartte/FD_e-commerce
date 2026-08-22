// ─────────────────────────────────────────────────────────────
// Helpers compartilhados pra falar com a API do Mercado Pago
// (usados por mercadopago-create-payment e mercadopago-webhook).
// Documentação: developers.mercadopago.com — Checkout Transparente /
// Checkout Bricks (Card Payment Brick) + Payments API + Webhooks.
// ─────────────────────────────────────────────────────────────

const MP_API_BASE = "https://api.mercadopago.com";

export interface MercadoPagoPayer {
  email: string;
  identification?: { type: string; number: string };
}

export interface CreatePaymentParams {
  accessToken: string;
  transactionAmount: number;
  token: string;
  paymentMethodId: string;
  issuerId?: string | number;
  installments: number;
  payer: MercadoPagoPayer;
  externalReference: string;
  notificationUrl: string;
  description: string;
  idempotencyKey: string;
}

export interface MercadoPagoPaymentResult {
  id: number;
  status: string; // approved | in_process | rejected | cancelled | ...
  status_detail: string;
  transaction_amount: number;
  external_reference: string | null;
}

// POST /v1/payments — cria a cobrança a partir do token gerado pelo Card
// Payment Brick no navegador do cliente. O card token é de uso único e já
// nasce PCI-compliant (o cru do cartão nunca passa pelo nosso servidor).
export async function createMercadoPagoPayment(
  params: CreatePaymentParams,
): Promise<{ ok: boolean; status: number; payment?: MercadoPagoPaymentResult; error?: string }> {
  const res = await fetch(`${MP_API_BASE}/v1/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${params.accessToken}`,
      "X-Idempotency-Key": params.idempotencyKey,
    },
    body: JSON.stringify({
      transaction_amount: params.transactionAmount,
      token: params.token,
      description: params.description,
      installments: params.installments,
      payment_method_id: params.paymentMethodId,
      issuer_id: params.issuerId,
      payer: params.payer,
      external_reference: params.externalReference,
      notification_url: params.notificationUrl,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("[mercadopago] Erro ao criar pagamento:", res.status, data);
    return { ok: false, status: res.status, error: data?.message ?? "Erro ao processar pagamento." };
  }

  return { ok: true, status: res.status, payment: data as MercadoPagoPaymentResult };
}

// GET /v1/payments/{id} — usado pelo webhook: NUNCA confia no corpo da
// notificação em si (só carrega um id), sempre rebusca o pagamento na API
// com nosso próprio access token pra saber o status real.
export async function getMercadoPagoPayment(
  accessToken: string,
  paymentId: string,
): Promise<MercadoPagoPaymentResult | null> {
  const res = await fetch(`${MP_API_BASE}/v1/payments/${paymentId}`, {
    headers: { "Authorization": `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    console.error("[mercadopago] Erro ao buscar pagamento:", res.status, await res.text());
    return null;
  }
  return await res.json();
}

// Valida o header x-signature das notificações de webhook. Formato:
// "ts=1704908010,v1=<hmac hex>" — o manifest usado no HMAC é
// "id:{data.id em minúsculas};request-id:{x-request-id};ts:{ts};".
// https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks
export async function verifyMercadoPagoSignature({
  xSignature,
  xRequestId,
  dataId,
  secret,
}: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
  secret: string;
}): Promise<boolean> {
  if (!xSignature || !xRequestId) return false;

  const parts = Object.fromEntries(
    xSignature.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${ts};`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const computedHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(computedHex, v1);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
