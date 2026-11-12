import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, jsonRequest } from "../_shared/testing/fakeSupabase.ts";
import { handleInfinitePayCheckout } from "./handler.ts";

const CREATED = "2026-11-11T12:00:00Z";
const ORDER = {
  id: "order-1", order_number: 7, total: 15.9, address: { name: "Maria", phone: "31999991234" },
  status: "pending", payment_provider: "infinitepay", payment_status: "aguardando_pagamento",
  payment_link_url: null, created_at: CREATED,
};
const CONFIG = { infinitepay_handle: "dudubebidas", infinitepay_api_key: "inchk_teste" };

let db: ReturnType<typeof createFakeSupabase>;
let fetchFn: ReturnType<typeof vi.fn>;

function setup(order: unknown = ORDER, config: unknown = CONFIG) {
  db = createFakeSupabase({
    orders: order,
    store_payment_configs: config,
    order_items: [{ name: "Coca-Cola 2L", price: 10.9, quantity: 1 }],
    stores: { site_url: "https://loja.teste" },
  });
}

const call = (body: Record<string, unknown>, minutesAfter = 1) =>
  handleInfinitePayCheckout(jsonRequest({ orderId: "order-1", storeId: "store-a", ...body }), {
    serviceClient: () => db as never,
    functionsBaseUrl: "https://x.supabase.co/functions/v1",
    fetchFn: fetchFn as never,
    now: () => new Date(new Date(CREATED).getTime() + minutesAfter * 60_000),
  });

beforeEach(() => {
  setup();
  fetchFn = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ url: "https://checkout.infinitepay.com.br/abc" }) }));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("infinitepay-checkout: criar link", () => {
  it("cria o link, guarda no pedido e devolve a URL", async () => {
    const res = await call({ action: "create" });
    expect(await res.json()).toEqual({ url: "https://checkout.infinitepay.com.br/abc" });
    expect(db.queries.find((q) => q.update)).toMatchObject({
      table: "orders",
      update: { payment_link_url: "https://checkout.infinitepay.com.br/abc" },
      filters: { id: "order-1", store_id: "store-a" },
    });
  });

  it("o aviso de pagamento vai com a loja e o link vence 30 min depois do pedido", async () => {
    await call({ action: "create" });
    const sent = JSON.parse((fetchFn.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.webhook.url).toBe("https://x.supabase.co/functions/v1/infinitepay-webhook?store_id=store-a");
    expect(sent.options.valid_until).toBe("2026-11-11T12:30:00.000Z");
    expect(sent.redirect_url).toBe("https://loja.teste/confirmacao");
  });

  it("pedido que já tem link: devolve o mesmo, sem criar outro (um link só por pedido)", async () => {
    setup({ ...ORDER, payment_link_url: "https://checkout.infinitepay.com.br/antigo" });
    expect(await (await call({ action: "create" })).json()).toEqual({ url: "https://checkout.infinitepay.com.br/antigo" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("pedido já pago", async () => {
    setup({ ...ORDER, payment_status: "pago" });
    expect(await (await call({ action: "create" })).json()).toEqual({ paid: true });
  });

  it("passou de 30 min: prazo acabou", async () => {
    const res = await call({ action: "create" }, 31);
    expect(res.status).toBe(410);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it.each([
    ["pedido inexistente ou de outra loja", null, 404],
    ["pedido que não é pagamento online", { ...ORDER, payment_provider: "pix_manual" }, 404],
    ["pedido cancelado", { ...ORDER, status: "cancelled" }, 400],
  ])("%s: %s", async (_, order, status) => {
    setup(order);
    expect((await call({ action: "create" })).status).toBe(status);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("loja sem InfinitePay configurada", async () => {
    setup(ORDER, null);
    const res = await call({ action: "create" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("não configurou");
  });

  it("InfinitePay recusou criar o link: mensagem amigável", async () => {
    fetchFn = vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ error: "x" }) }));
    const res = await call({ action: "create" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("pagamento online");
  });

  it("sem pedido ou loja: 400", async () => {
    const res = await handleInfinitePayCheckout(jsonRequest({ action: "create" }), {
      serviceClient: () => db as never, functionsBaseUrl: "x",
    });
    expect(res.status).toBe(400);
  });
});

describe("infinitepay-checkout: conferir na volta do cliente", () => {
  it("pago: confirma", async () => {
    fetchFn = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true, paid: true, amount: 1590, paid_amount: 1590, capture_method: "pix", installments: 1 }) }));
    db = createFakeSupabase({ orders: ORDER, store_payment_configs: CONFIG }, { confirm_infinitepay_payment: { data: { success: true }, error: null } });
    const res = await call({ action: "check", transactionNsu: "tx-1", slug: "slug-1" });
    expect(await res.json()).toEqual({ status: "paid", paid: true });
  });

  it("ainda não pago", async () => {
    fetchFn = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true, paid: false }) }));
    expect(await (await call({ action: "check", transactionNsu: "tx-1", slug: "slug-1" })).json()).toEqual({ status: "not_paid", paid: false });
  });
});
