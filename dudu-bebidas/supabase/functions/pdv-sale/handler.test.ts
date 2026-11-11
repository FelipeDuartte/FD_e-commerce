import { beforeEach, describe, expect, it, vi } from "vitest";
import { FulfillmentError } from "../_shared/orderFulfillment.ts";
import { createFakeSupabase, jsonRequest } from "../_shared/testing/fakeSupabase.ts";
import { handlePdvSale } from "./handler.ts";

const SALE = {
  cartItems: [{ id: "p1", name: "Brahma 600ml", quantity: 3, usePromoPrice: false }],
  paymentMethod: "cash",
  cashSessionId: "caixa-1",
};

let adminDb: ReturnType<typeof createFakeSupabase>; // client do admin (com RLS)
let serviceDb: ReturnType<typeof createFakeSupabase>; // service role
let fulfillOrder: ReturnType<typeof vi.fn>;

const admin = () => ({ userId: "operador-1", storeId: "store-a", client: adminDb as never });

function deps(overrides = {}) {
  return {
    requireStoreAdmin: vi.fn(async () => admin()),
    serviceClient: () => serviceDb as never,
    fulfillOrder: fulfillOrder as never,
    ...overrides,
  };
}

const sale = async (body: unknown, overrides = {}) => handlePdvSale(jsonRequest(body), deps(overrides));
const sentToFulfill = () => fulfillOrder.mock.calls[0][1];

beforeEach(() => {
  adminDb = createFakeSupabase({ cash_sessions: { id: "caixa-1", status: "open" } });
  serviceDb = createFakeSupabase();
  fulfillOrder = vi.fn(async () => ({ orderId: "order-9", orderNumber: 9 }));
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("pdv-sale", () => {
  it("registra a venda e devolve o número", async () => {
    const res = await sale(SALE);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ orderId: "order-9", orderNumber: 9 });
  });

  it("venda de balcão: entregue no ato, sem cliente, com o operador e o caixa", async () => {
    await sale(SALE);
    expect(fulfillOrder).toHaveBeenCalledWith(serviceDb, expect.objectContaining({
      channel: "balcao",
      status: "delivered",
      userId: null,
      soldBy: "operador-1",
      cashSessionId: "caixa-1",
      applyCardFee: true,
      skipStockDecrement: false,
    }));
  });

  it("sem endereço = retirada no balcão; parcelas ausentes = null", async () => {
    await sale(SALE);
    expect(sentToFulfill()).toMatchObject({ address: {}, installments: null });
  });

  it("repassa desconto, pagamento dividido, fiado e entrega", async () => {
    const extra = {
      discountAmount: 5,
      payments: [{ method: "cash", amount: 10 }, { method: "pix", amount: 5 }],
      pdvCustomerId: "cliente-7",
      installments: 3,
      address: { street: "Rua B", number: "20" },
    };
    await sale({ ...SALE, ...extra });
    expect(sentToFulfill()).toMatchObject(extra);
  });

  it("pedido fiado com baixa adiada não baixa estoque agora", async () => {
    await sale({ ...SALE, deferStockUntilPaid: true });
    expect(sentToFulfill().skipStockDecrement).toBe(true);
  });

  describe("segurança", () => {
    it("quem não é admin recebe 403 e nada é gravado", async () => {
      const res = await sale(SALE, { requireStoreAdmin: vi.fn(async () => null) });
      expect(res.status).toBe(403);
      expect(fulfillOrder).not.toHaveBeenCalled();
    });

    it("a loja é sempre a do admin, nunca a do corpo da requisição", async () => {
      await sale({ ...SALE, storeId: "loja-de-outra-pessoa" });
      expect(sentToFulfill().storeId).toBe("store-a");
    });

    it("o operador é sempre quem está logado, nunca o do corpo", async () => {
      await sale({ ...SALE, soldBy: "outro-operador" });
      expect(sentToFulfill().soldBy).toBe("operador-1");
    });

    it("o caixa é conferido com o login do admin (RLS isola por loja)", async () => {
      await sale(SALE);
      expect(adminDb.queries).toEqual([{ table: "cash_sessions", filters: { id: "caixa-1" } }]);
      expect(serviceDb.queries.some((q) => q.table === "cash_sessions")).toBe(false);
    });
  });

  describe("caixa", () => {
    it("sem caixa informado: 400", async () => {
      const { cashSessionId: _, ...semCaixa } = SALE;
      const res = await sale(semCaixa);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Nenhum caixa aberto informado." });
    });

    it.each([
      ["fechado", { id: "caixa-1", status: "closed" }],
      ["de outra loja (RLS não encontra)", null],
      ["erro do banco", { data: null, error: { message: "falha" } }],
    ])("caixa %s: 400 e nada é gravado", async (_, cashSession) => {
      adminDb = createFakeSupabase({ cash_sessions: cashSession });
      const res = await sale(SALE);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Caixa inválido ou já fechado." });
      expect(fulfillOrder).not.toHaveBeenCalled();
    });
  });

  describe("erros", () => {
    it("erro de negócio volta com a mensagem pro operador", async () => {
      fulfillOrder.mockRejectedValue(new FulfillmentError("A soma do pagamento dividido não bate com o total.", 400));
      const res = await sale(SALE);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("pagamento dividido");
    });

    it("erro inesperado vira 500 genérico", async () => {
      fulfillOrder.mockRejectedValue(new Error("timeout"));
      const res = await sale(SALE);
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Erro interno do servidor." });
    });
  });
});
