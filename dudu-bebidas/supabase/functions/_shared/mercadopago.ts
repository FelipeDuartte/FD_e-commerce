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
  first_name?: string;
  last_name?: string;
  phone?: { area_code: string; number: string };
  address?: { zip_code?: string; street_name?: string; street_number?: string; city?: string };
}

export interface AdditionalInfoItem {
  id: string;
  title: string;
  description: string;
  quantity: number;
  unit_price: number;
}

export interface CreatePaymentParams {
  accessToken: string;
  transactionAmount: number;
  token: string;
  paymentMethodId: string;
  paymentMethodOptionId?: string;
  issuerId?: string | number;
  installments: number;
  payer: MercadoPagoPayer;
  externalReference: string;
  notificationUrl: string;
  description: string;
  idempotencyKey: string;
  // Nome que aparece na fatura do cartão do cliente e itens do carrinho —
  // recomendações da própria medição de qualidade do MP pra reduzir
  // contestações e recusas do antifraude deles.
  statementDescriptor?: string;
  items?: AdditionalInfoItem[];
}

export interface PayerCost {
  installments: number;
  installment_rate: number;
  installment_amount: number;
  total_amount: number;
  payment_method_option_id: string;
  min_allowed_amount: number;
  max_allowed_amount: number;
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
      payment_method_option_id: params.paymentMethodOptionId,
      issuer_id: params.issuerId,
      payer: params.payer,
      external_reference: params.externalReference,
      notification_url: params.notificationUrl,
      statement_descriptor: params.statementDescriptor,
      ...(params.items?.length ? { additional_info: { items: params.items } } : {}),
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("[mercadopago] Erro ao criar pagamento:", res.status, data);
    return { ok: false, status: res.status, error: data?.message ?? "Erro ao processar pagamento." };
  }

  return { ok: true, status: res.status, payment: data as MercadoPagoPaymentResult };
}

// GET /v1/card_tokens/{id} — recupera o BIN (6 primeiros dígitos) do
// cartão a partir do token já criado pelo Brick no navegador do cliente,
// sem precisar que ele reenvie nenhum dado do cartão. Só precisa da
// public key (não é segredo) — o BIN em si não é informação sensível.
export async function getCardTokenBin(
  publicKey: string,
  tokenId: string,
): Promise<string | null> {
  const res = await fetch(
    `${MP_API_BASE}/v1/card_tokens/${tokenId}?public_key=${encodeURIComponent(publicKey)}`,
  );
  if (!res.ok) {
    console.error("[mercadopago] Erro ao buscar token do cartão:", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  return data?.first_six_digits ?? null;
}

// GET /v1/payment_methods/installments — tabela OFICIAL de parcelas (com
// juros já calculados pelo próprio Mercado Pago) pra esse BIN/valor/meio de
// pagamento. Chamado sempre com o valor já validado no SERVIDOR (nunca o
// que o cliente mandar) — é isso que impede alguém de manipular o valor
// final cobrado via o número de parcelas.
export async function getInstallmentOptions(
  publicKey: string,
  amount: number,
  bin: string,
  paymentMethodId: string,
): Promise<PayerCost[] | null> {
  const url = `${MP_API_BASE}/v1/payment_methods/installments` +
    `?public_key=${encodeURIComponent(publicKey)}` +
    `&amount=${amount}` +
    `&bin=${encodeURIComponent(bin)}` +
    `&payment_method_id=${encodeURIComponent(paymentMethodId)}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error("[mercadopago] Erro ao buscar parcelas:", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  return data?.[0]?.payer_costs ?? null;
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
