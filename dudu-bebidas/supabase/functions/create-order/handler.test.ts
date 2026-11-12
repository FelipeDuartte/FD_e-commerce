import { beforeEach, describe, expect, it, vi } from "vitest";
import { FulfillmentError } from "../_shared/orderFulfillment.ts";
import { createFakeSupabase, jsonRequest } from "../_shared/testing/fakeSupabase.ts";
import { handleCreateOrder } from "./handler.ts";

const STORE = "store-a";
const ORDER = {
  cartItems: [{ id: "p1", name: "Heineken", quantity: 2 }],
  paymentMethod: "infinitepay",
  deliveryFee: 5,
  address: { street: "Rua A", number: "10", district: "Centro", cep: "30110000" },
};

let db: ReturnType<typeof createFakeSupabase>;
let fulfillOrder: ReturnType<typeof vi.fn>;

function deps(overrides = {}) {
  return {
    serviceClient: () => db as never,
    getUserId: vi.fn(async () => null),
    fulfillOrder: fulfillOrder as never,
    ...overrides,
  };
}

const post = (body: unknown, headers: Record<string, string> = { "x-store-id": STORE }) =>
  jsonRequest(body, { headers });

beforeEach(() => {
  db = createFakeSupabase({ stores: { id: STORE, is_active: true } });
  fulfillOrder = vi.fn(async () => ({ orderId: "order-1", orderNumber: 42 }));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("create-order", () => {
  it("cria o pedido online e devolve o número", async () => {
    const res = await handleCreateOrder(post(ORDER), deps());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ orderId: "order-1", orderNumber: 42 });
  });

  it("pedido do site nasce pendente, aguardando pagamento, com taxa de cartão", async () => {
    await handleCreateOrder(post(ORDER), deps());
    expect(fulfillOrder).toHaveBeenCalledWith(db, expect.objectContaining({
      storeId: STORE,
      channel: "online",
      status: "pending",
      paymentStatus: "aguardando_pagamento",
      applyCardFee: true,
      deliveryFee: 5,
      cartItems: ORDER.cartItems,
    }));
  });

  it.each([
    ["infinitepay", "infinitepay"],
    ["cash", null],
    ["credit_card", null],
  ])("pagamento %s → provider %s", async (paymentMethod, provider) => {
    await handleCreateOrder(post({ ...ORDER, paymentMethod }), deps());
    expect(fulfillOrder.mock.calls[0][1].paymentProvider).toBe(provider);
  });

  it.each(["pix", "mercadopago_card", "fiado", undefined])(
    "forma que o site não oferece mais (%s): 400 e nada é gravado",
    async (paymentMethod) => {
      const res = await handleCreateOrder(post({ ...ORDER, paymentMethod }), deps());
      expect(res.status).toBe(400);
      expect(fulfillOrder).not.toHaveBeenCalled();
    },
  );

  it("pagar online (InfinitePay): aguarda pagamento e só baixa estoque quando pagar", async () => {
    await handleCreateOrder(post({ ...ORDER, paymentMethod: "infinitepay" }), deps());
    expect(fulfillOrder.mock.calls[0][1]).toMatchObject({
      paymentMethod: "infinitepay",
      paymentProvider: "infinitepay",
      paymentStatus: "aguardando_pagamento",
      skipStockDecrement: true,
    });
  });

  it("pagamento na entrega continua baixando estoque na hora", async () => {
    await handleCreateOrder(post({ ...ORDER, paymentMethod: "cash" }), deps());
    expect(fulfillOrder.mock.calls[0][1].skipStockDecrement).toBe(false);
  });

  it("frete ausente vale zero", async () => {
    const { deliveryFee: _, ...semFrete } = ORDER;
    await handleCreateOrder(post(semFrete), deps());
    expect(fulfillOrder.mock.calls[0][1].deliveryFee).toBe(0);
  });

  describe("loja", () => {
    it("usa a loja do header x-store-id", async () => {
      await handleCreateOrder(post(ORDER), deps());
      expect(db.queries.find((q) => q.table === "stores")?.filters).toEqual({ id: STORE });
    });

    it("header tem prioridade sobre o storeId do corpo", async () => {
      await handleCreateOrder(post({ ...ORDER, storeId: "outra-loja" }), deps());
      expect(fulfillOrder.mock.calls[0][1].storeId).toBe(STORE);
    });

    it("aceita storeId no corpo quando não há header (client antigo)", async () => {
      await handleCreateOrder(post({ ...ORDER, storeId: STORE }, {}), deps());
      expect(fulfillOrder.mock.calls[0][1].storeId).toBe(STORE);
    });

    it("sem loja identificada: 400 e nada é gravado", async () => {
      const res = await handleCreateOrder(post(ORDER, {}), deps());
      expect(res.status).toBe(400);
      expect(fulfillOrder).not.toHaveBeenCalled();
    });

    it.each([
      ["inexistente", null],
      ["inativa", { id: STORE, is_active: false }],
      ["erro do banco", { data: null, error: { message: "falha" } }],
    ])("loja %s: 400 e nada é gravado", async (_, stores) => {
      db = createFakeSupabase({ stores });
      const res = await handleCreateOrder(post(ORDER), deps());
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Loja inválida ou inativa." });
      expect(fulfillOrder).not.toHaveBeenCalled();
    });
  });

  describe("cliente", () => {
    it("convidado: pedido sem usuário", async () => {
      await handleCreateOrder(post(ORDER), deps());
      expect(fulfillOrder.mock.calls[0][1].userId).toBeNull();
    });

    it("usuário vem do login (JWT), nunca do corpo da requisição", async () => {
      const getUserId = vi.fn(async () => "user-real");
      await handleCreateOrder(
        post({ ...ORDER, userId: "user-de-outra-pessoa" }, { "x-store-id": STORE, Authorization: "Bearer jwt" }),
        deps({ getUserId }),
      );
      expect(getUserId).toHaveBeenCalledWith("Bearer jwt");
      expect(fulfillOrder.mock.calls[0][1].userId).toBe("user-real");
    });
  });

  describe("erros", () => {
    it("erro de negócio (ex: estoque) volta com a mensagem e o status dele", async () => {
      fulfillOrder.mockRejectedValue(new FulfillmentError("Estoque insuficiente para Heineken.", 400));
      const res = await handleCreateOrder(post(ORDER), deps());
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Estoque insuficiente para Heineken." });
    });

    it("erro inesperado vira 500 sem vazar detalhe", async () => {
      fulfillOrder.mockRejectedValue(new Error("connection reset"));
      const res = await handleCreateOrder(post(ORDER), deps());
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Erro interno do servidor." });
    });

    it("corpo que não é JSON vira 500, sem gravar nada", async () => {
      const req = new Request("https://fn.test/", { method: "POST", headers: { "x-store-id": STORE }, body: "{" });
      const res = await handleCreateOrder(req, deps());
      expect(res.status).toBe(500);
      expect(fulfillOrder).not.toHaveBeenCalled();
    });
  });

  it("preflight do navegador (OPTIONS) libera o header x-store-id", async () => {
    const res = await handleCreateOrder(new Request("https://fn.test/", { method: "OPTIONS" }), deps());
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("x-store-id");
  });
});
