import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildLinkPayload,
  checkPayment,
  createPaymentLink,
  customerPhone,
  linkItems,
  verifyAndConfirm,
} from "./infinitepay.ts";
import { createFakeSupabase } from "./testing/fakeSupabase.ts";

const CONFIG = { handle: "dudubebidas", apiKey: "inchk_teste" };
const ORDER = { id: "order-1", order_number: 42, total: 15.9, address: { name: "Maria", phone: "(31) 99999-1234" } };
const ITEMS = [{ name: "Coca-Cola 2L", price: 10.9, quantity: 1 }];

const respond = (status: number, body: unknown) =>
  vi.fn(async () => ({ ok: status < 400, status, json: async () => body }) as Response);

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("itens do link", () => {
  it("produtos + frete como 'Entrega', somando exatamente o total", () => {
    expect(linkItems(ORDER, ITEMS)).toEqual([
      { description: "Coca-Cola 2L", price: 1090, quantity: 1 },
      { description: "Entrega", price: 500, quantity: 1 },
    ]);
  });
  it("sem frete: só os produtos", () => {
    expect(linkItems({ ...ORDER, total: 10.9 }, ITEMS)).toHaveLength(1);
  });
  it("se não fechar, cobra o pedido inteiro numa linha (nunca diverge do total)", () => {
    expect(linkItems({ ...ORDER, total: 5 }, ITEMS)).toEqual([{ description: "Pedido #42", price: 500, quantity: 1 }]);
  });
  it("centavos quebrados não geram diferença", () => {
    const items = [{ name: "A", price: 5.9, quantity: 1 }, { name: "B", price: 7.2, quantity: 1 }];
    const lines = linkItems({ ...ORDER, total: 13.1 }, items);
    expect(lines.reduce((s, l) => s + l.price * l.quantity, 0)).toBe(1310);
  });
});

describe("telefone do cliente", () => {
  it.each([
    ["(31) 99999-1234", "+5531999991234"],
    ["5531999991234", "+5531999991234"],
    ["3134510200", "+553134510200"],
    ["123", null],
    [undefined, null],
  ])("%s → %s", (raw, expected) => {
    expect(customerPhone(raw as string)).toBe(expected);
  });
});

describe("pedido do link", () => {
  const payload = buildLinkPayload({
    order: ORDER,
    items: ITEMS,
    config: CONFIG,
    siteUrl: "https://dudubebidas.com.br/",
    webhookUrl: "https://x.supabase.co/functions/v1/infinitepay-webhook?store_id=s1",
    now: new Date("2026-11-11T12:00:00Z"),
  });

  it("taxa do cartão sempre do cliente; link de uso único", () => {
    expect(payload.options).toMatchObject({ assured_installments: 0, single_payment: true });
  });
  it("não pede o endereço de novo (já veio do checkout do site)", () => {
    expect((payload.options as Record<string, unknown>).require_delivery_address).toBe(false);
  });
  it("vale 30 minutos", () => {
    expect((payload.options as { valid_until: string }).valid_until).toBe("2026-11-11T12:30:00.000Z");
  });
  it("número do pedido, aviso de pagamento e volta pra confirmação", () => {
    expect(payload).toMatchObject({
      handle: "dudubebidas",
      order_nsu: "order-1",
      redirect_url: "https://dudubebidas.com.br/confirmacao",
      webhook: { url: "https://x.supabase.co/functions/v1/infinitepay-webhook?store_id=s1", events: ["paid"] },
      customer: { name: "Maria", phone_number: "+5531999991234" },
    });
  });
  it("valor abaixo de R$ 1,00 não cria link", () => {
    expect(() =>
      buildLinkPayload({ order: { ...ORDER, total: 0.5 }, items: [], config: CONFIG, siteUrl: null, webhookUrl: "u" })
    ).toThrow("R$ 1,00");
  });
});

describe("criar link", () => {
  it("manda a chave da loja e devolve a URL", async () => {
    const fetchFn = respond(200, { url: "https://checkout.infinitepay.com.br/abc" });
    expect(await createPaymentLink({}, CONFIG, fetchFn)).toBe("https://checkout.infinitepay.com.br/abc");
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.checkout.infinitepay.io/links",
      expect.objectContaining({ headers: expect.objectContaining({ "X-Api-Key": "inchk_teste" }) }),
    );
  });
  it("aceita o campo 'link' também", async () => {
    expect(await createPaymentLink({}, CONFIG, respond(200, { link: "https://checkout.infinitepay.com.br/x" }))).toContain("/x");
  });
  it.each([
    ["erro da InfinitePay", respond(403, { error: "external_checkout_not_enabled" })],
    ["resposta sem URL", respond(200, {})],
  ])("%s: mensagem amigável", async (_, fetchFn) => {
    await expect(createPaymentLink({}, CONFIG, fetchFn)).rejects.toThrow("pagamento online");
  });
});

describe("conferir pagamento", () => {
  const IDS = { orderNsu: "order-1", transactionNsu: "tx-1", slug: "slug-1" };
  it("pago", async () => {
    const r = await checkPayment(IDS, CONFIG, respond(200, { success: true, paid: true, amount: 1590, paid_amount: 1590, installments: 1, capture_method: "pix" }));
    expect(r).toEqual({ paid: true, amount: 1590, paidAmount: 1590, installments: 1, captureMethod: "pix" });
  });
  it.each([
    ["não pago", respond(200, { success: true, paid: false })],
    ["dados não batem", respond(200, { success: false })],
    ["erro HTTP", respond(500, {})],
    ["sem internet", vi.fn(async () => { throw new Error("offline"); })],
  ])("%s = não pago", async (_, fetchFn) => {
    expect((await checkPayment(IDS, CONFIG, fetchFn as typeof fetch)).paid).toBe(false);
  });
});

describe("confirmar pedido (webhook e volta do cliente)", () => {
  const IDS = { storeId: "store-a", orderNsu: "order-1", transactionNsu: "tx-1", slug: "slug-1" };
  const pendingOrder = { id: "order-1", total: 15.9, payment_provider: "infinitepay", payment_status: "aguardando_pagamento" };
  const configRow = { infinitepay_handle: "$dudubebidas", infinitepay_api_key: "inchk_teste" };
  const paid = (body: Record<string, unknown> = {}) =>
    respond(200, { success: true, paid: true, amount: 1590, paid_amount: 1590, installments: 1, capture_method: "pix", ...body });

  it("pago com o valor certo: confirma e registra o que o cliente pagou", async () => {
    const db = createFakeSupabase({ orders: pendingOrder, store_payment_configs: configRow }, {
      confirm_infinitepay_payment: { data: { success: true }, error: null },
    });
    expect(await verifyAndConfirm(db as never, IDS, paid({ capture_method: "credit_card", paid_amount: 1642 }))).toBe("paid");
    expect(db.rpcCalls).toEqual([{
      name: "confirm_infinitepay_payment",
      params: {
        p_order_id: "order-1", p_store_id: "store-a", p_transaction_nsu: "tx-1",
        p_capture_method: "credit_card", p_paid_amount: 16.42, p_installments: 1,
      },
    }]);
  });

  it("confere com a InfinitePay usando a tag sem o $", async () => {
    const fetchFn = paid();
    const db = createFakeSupabase({ orders: pendingOrder, store_payment_configs: configRow });
    await verifyAndConfirm(db as never, IDS, fetchFn);
    expect(JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string)).toMatchObject({ handle: "dudubebidas" });
  });

  it("valor do link diferente do pedido: NÃO confirma", async () => {
    const db = createFakeSupabase({ orders: pendingOrder, store_payment_configs: configRow });
    expect(await verifyAndConfirm(db as never, IDS, paid({ amount: 100 }))).toBe("amount_mismatch");
    expect(db.rpcCalls).toEqual([]);
  });

  it("InfinitePay diz que não pagou: não confirma", async () => {
    const db = createFakeSupabase({ orders: pendingOrder, store_payment_configs: configRow });
    expect(await verifyAndConfirm(db as never, IDS, respond(200, { success: true, paid: false }))).toBe("not_paid");
    expect(db.rpcCalls).toEqual([]);
  });

  it.each([
    ["pedido de outra loja / inexistente", { orders: null, store_payment_configs: configRow }],
    ["pedido que não é InfinitePay", { orders: { ...pendingOrder, payment_provider: "pix_manual" }, store_payment_configs: configRow }],
    ["loja sem InfinitePay configurada", { orders: pendingOrder, store_payment_configs: null }],
  ])("%s: ignora sem consultar nada", async (_, tables) => {
    const fetchFn = paid();
    const db = createFakeSupabase(tables);
    expect(await verifyAndConfirm(db as never, IDS, fetchFn)).toBe("ignored");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("já pago: não confere de novo", async () => {
    const fetchFn = paid();
    const db = createFakeSupabase({ orders: { ...pendingOrder, payment_status: "pago" }, store_payment_configs: configRow });
    expect(await verifyAndConfirm(db as never, IDS, fetchFn)).toBe("already_paid");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("aviso sem os códigos do pagamento: ignora", async () => {
    const db = createFakeSupabase({ orders: pendingOrder, store_payment_configs: configRow });
    expect(await verifyAndConfirm(db as never, { ...IDS, slug: "" }, paid())).toBe("ignored");
  });
});
