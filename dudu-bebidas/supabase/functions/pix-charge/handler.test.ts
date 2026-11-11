import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, jsonRequest } from "../_shared/testing/fakeSupabase.ts";
import { handlePixCharge } from "./handler.ts";

const ORDER_ID = "0b6f7c1e-1234-4abc-9def-1234567890ab";
const ORDER = { id: ORDER_ID, total: 45.9, payment_method: "pix" };
const CONFIG = {
  pix_key: "(31) 99999-8888",
  pix_key_type: "telefone",
  pix_merchant_name: "Dudu Bebidas",
  pix_merchant_city: "Belo Horizonte",
};

let db: ReturnType<typeof createFakeSupabase>;

const charge = (body: unknown = { orderId: ORDER_ID, storeId: "store-a" }) =>
  handlePixCharge(jsonRequest(body), { serviceClient: () => db as never });

beforeEach(() => {
  db = createFakeSupabase({ orders: ORDER, store_payment_configs: CONFIG });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("pix-charge", () => {
  it("gera o Pix copia e cola com o valor do pedido", async () => {
    const res = await charge();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ pixKey: "+5531999998888", merchantName: "Dudu Bebidas", amount: 45.9 });
    expect(body.brCode).toContain("540545.90"); // campo 54 = valor
    expect(body.brCode).toContain("+5531999998888");
  });

  it("valor vem do pedido salvo, nunca da requisição", async () => {
    const body = await (await charge({ orderId: ORDER_ID, storeId: "store-a", amount: 0.01 })).json();
    expect(body.amount).toBe(45.9);
  });

  it("procura o pedido só na loja informada", async () => {
    await charge();
    expect(db.queries[0]).toEqual({ table: "orders", filters: { id: ORDER_ID, store_id: "store-a" } });
  });

  it("chave que não é telefone vai como está", async () => {
    db = createFakeSupabase({ orders: ORDER, store_payment_configs: { ...CONFIG, pix_key: "pix@loja.com", pix_key_type: "email" } });
    expect((await (await charge()).json()).pixKey).toBe("pix@loja.com");
  });

  it("loja sem nome/cidade usa valores padrão", async () => {
    db = createFakeSupabase({ orders: ORDER, store_payment_configs: { ...CONFIG, pix_merchant_name: null, pix_merchant_city: null } });
    const body = await (await charge()).json();
    expect(body.merchantName).toBe("Loja");
    expect(body.brCode).toContain("5904LOJA");
  });

  describe("erros", () => {
    it.each([
      ["sem orderId", { storeId: "store-a" }],
      ["sem storeId", { orderId: ORDER_ID }],
    ])("%s: 400", async (_, body) => {
      expect((await charge(body)).status).toBe(400);
    });

    it("pedido de outra loja ou inexistente: 404", async () => {
      db = createFakeSupabase({ orders: null, store_payment_configs: CONFIG });
      expect((await charge()).status).toBe(404);
    });

    it("pedido que não é Pix: 400", async () => {
      db = createFakeSupabase({ orders: { ...ORDER, payment_method: "cash" }, store_payment_configs: CONFIG });
      const res = await charge();
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Este pedido não é pago via Pix." });
    });

    it("loja sem chave Pix: 400", async () => {
      db = createFakeSupabase({ orders: ORDER, store_payment_configs: { ...CONFIG, pix_key: null } });
      expect(await (await charge()).json()).toEqual({ error: "Esta loja ainda não configurou a chave Pix." });
    });

    it("erro inesperado: 500", async () => {
      db = { from: () => { throw new Error("db fora"); } } as never;
      expect((await charge()).status).toBe(500);
    });
  });
});
