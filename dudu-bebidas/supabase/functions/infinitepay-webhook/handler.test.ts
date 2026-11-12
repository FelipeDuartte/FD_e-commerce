import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, jsonRequest } from "../_shared/testing/fakeSupabase.ts";
import { handleInfinitePayWebhook } from "./handler.ts";

const URL_LOJA = "https://fn.test/infinitepay-webhook?store_id=store-a";
const AVISO = { order_nsu: "order-1", transaction_nsu: "tx-1", invoice_slug: "slug-1", amount: 1590, paid_amount: 1590 };

let tasks: Promise<unknown>[];
let fetchFn: ReturnType<typeof vi.fn>;
let db: ReturnType<typeof createFakeSupabase>;

const notify = (body: unknown = AVISO, url = URL_LOJA) =>
  handleInfinitePayWebhook(jsonRequest(body, { url }), {
    serviceClient: () => db as never,
    background: (t) => tasks.push(t),
    fetchFn: fetchFn as never,
  });

beforeEach(() => {
  tasks = [];
  db = createFakeSupabase(
    {
      orders: { id: "order-1", total: 15.9, payment_provider: "infinitepay", payment_status: "aguardando_pagamento" },
      store_payment_configs: { infinitepay_handle: "dudubebidas", infinitepay_api_key: "inchk_teste" },
    },
    { confirm_infinitepay_payment: { data: { success: true }, error: null } },
  );
  fetchFn = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true, paid: true, amount: 1590, paid_amount: 1590, capture_method: "pix", installments: 1 }) }));
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("infinitepay-webhook", () => {
  it("responde 200 na hora e confere em segundo plano", async () => {
    const res = await notify();
    expect(res.status).toBe(200);
    expect(tasks).toHaveLength(1);
    await Promise.all(tasks);
    expect(db.rpcCalls.map((c) => c.name)).toEqual(["confirm_infinitepay_payment"]);
  });

  it("valor 'pago' no corpo do aviso não basta: quem decide é a InfinitePay", async () => {
    fetchFn = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true, paid: false }) }));
    await notify({ ...AVISO, paid: true, status: "approved" });
    await Promise.all(tasks);
    expect(db.rpcCalls).toEqual([]);
  });

  it.each([
    ["sem loja na URL", AVISO, "https://fn.test/infinitepay-webhook"],
    ["sem os códigos do pagamento", { order_nsu: "order-1" }, URL_LOJA],
  ])("%s: ignora (200, nada conferido)", async (_, body, url) => {
    const res = await notify(body, url);
    expect(res.status).toBe(200);
    expect(tasks).toEqual([]);
  });

  it("corpo inválido não derruba", async () => {
    const req = new Request(URL_LOJA, { method: "POST", body: "{" });
    const res = await handleInfinitePayWebhook(req, { serviceClient: () => db as never, background: (t) => tasks.push(t) });
    expect(res.status).toBe(200);
  });
});
