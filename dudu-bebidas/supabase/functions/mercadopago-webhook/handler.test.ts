import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase, jsonRequest } from "../_shared/testing/fakeSupabase.ts";
import { handleMercadoPagoWebhook } from "./handler.ts";

const URL_LOJA = "https://fn.test/mercadopago-webhook?store_id=store-a";
const NOTIFICATION = { type: "payment", data: { id: "123456" } };
const CONFIG = { mercadopago_access_token: "APP_USR-token", mercadopago_webhook_secret: null };

let db: ReturnType<typeof createFakeSupabase>;
let getPayment: ReturnType<typeof vi.fn>;
let verifySignature: ReturnType<typeof vi.fn>;

const payment = (status: string, overrides = {}) => ({
  id: 123456,
  status,
  status_detail: "x",
  external_reference: "order-1",
  ...overrides,
});

function notify(body: unknown = NOTIFICATION, url = URL_LOJA, headers: Record<string, string> = {}) {
  return handleMercadoPagoWebhook(jsonRequest(body, { url, headers }), {
    serviceClient: () => db as never,
    getPayment: getPayment as never,
    verifySignature: verifySignature as never,
  });
}

const rpcNames = () => db.rpcCalls.map((c) => c.name);

beforeEach(() => {
  db = createFakeSupabase({ store_payment_configs: CONFIG });
  getPayment = vi.fn(async () => payment("approved"));
  verifySignature = vi.fn(async () => true);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("mercadopago-webhook", () => {
  describe("resultado do pagamento", () => {
    it("aprovado confirma o pagamento do pedido da loja", async () => {
      const res = await notify();
      expect(res.status).toBe(200);
      expect(db.rpcCalls).toEqual([{
        name: "confirm_mercadopago_payment",
        params: { p_order_id: "order-1", p_store_id: "store-a", p_payment_id: "123456" },
      }]);
    });

    it.each(["rejected", "cancelled"])("%s apaga o pedido que nunca foi pago", async (status) => {
      getPayment.mockResolvedValue(payment(status));
      await notify();
      expect(db.rpcCalls).toEqual([{
        name: "delete_rejected_mercadopago_order",
        params: { p_order_id: "order-1", p_store_id: "store-a" },
      }]);
    });

    it.each(["in_process", "pending", "authorized"])("%s ainda não decide nada", async (status) => {
      getPayment.mockResolvedValue(payment(status));
      await notify();
      expect(db.rpcCalls).toEqual([]);
    });

    it("status vem da API do MP com o token da loja, nunca do corpo da notificação", async () => {
      getPayment.mockResolvedValue(payment("rejected"));
      await notify({ ...NOTIFICATION, status: "approved", action: "payment.updated" });
      expect(getPayment).toHaveBeenCalledWith("APP_USR-token", "123456");
      expect(rpcNames()).toEqual(["delete_rejected_mercadopago_order"]);
    });

    it("o pedido vem do external_reference do pagamento", async () => {
      getPayment.mockResolvedValue(payment("approved", { external_reference: "order-77" }));
      await notify();
      expect(db.rpcCalls[0].params?.p_order_id).toBe("order-77");
    });
  });

  describe("assinatura", () => {
    beforeEach(() => {
      db = createFakeSupabase({ store_payment_configs: { ...CONFIG, mercadopago_webhook_secret: "segredo" } });
    });

    it("loja com chave secreta: assinatura inválida é recusada (401) sem consultar o MP", async () => {
      verifySignature.mockResolvedValue(false);
      const res = await notify();
      expect(res.status).toBe(401);
      expect(getPayment).not.toHaveBeenCalled();
      expect(db.rpcCalls).toEqual([]);
    });

    it("confere com os headers recebidos e a chave da loja", async () => {
      await notify(NOTIFICATION, URL_LOJA, { "x-signature": "ts=1,v1=abc", "x-request-id": "req-1" });
      expect(verifySignature).toHaveBeenCalledWith({
        xSignature: "ts=1,v1=abc",
        xRequestId: "req-1",
        dataId: "123456",
        secret: "segredo",
      });
      expect(rpcNames()).toEqual(["confirm_mercadopago_payment"]);
    });

    it("loja sem chave secreta configurada não confere assinatura", async () => {
      db = createFakeSupabase({ store_payment_configs: CONFIG });
      await notify();
      expect(verifySignature).not.toHaveBeenCalled();
    });
  });

  describe("notificações ignoradas (sempre 200, pro MP não reenviar)", () => {
    const ignored = async (res: Response) => {
      expect(res.status).toBe(200);
      expect(db.rpcCalls).toEqual([]);
    };

    it("URL sem store_id", async () => {
      await ignored(await notify(NOTIFICATION, "https://fn.test/mercadopago-webhook"));
      expect(db.queries).toEqual([]);
    });

    it("tipo que não é pagamento (merchant_order)", async () => {
      await ignored(await notify({ type: "merchant_order", data: { id: "1" } }));
      expect(getPayment).not.toHaveBeenCalled();
    });

    it("loja sem Mercado Pago configurado", async () => {
      db = createFakeSupabase({ store_payment_configs: null });
      await ignored(await notify());
      expect(getPayment).not.toHaveBeenCalled();
    });

    it("pagamento não encontrado no MP", async () => {
      getPayment.mockResolvedValue(null);
      await ignored(await notify());
    });

    it("pagamento sem pedido associado", async () => {
      getPayment.mockResolvedValue(payment("approved", { external_reference: null }));
      await ignored(await notify());
    });

    it("erro inesperado também responde 200", async () => {
      getPayment.mockRejectedValue(new Error("MP fora do ar"));
      await ignored(await notify());
    });
  });

  it("aceita o formato antigo (id e topic na URL, sem corpo)", async () => {
    const req = new Request(`${URL_LOJA}&topic=payment&id=555`, { method: "POST" });
    await handleMercadoPagoWebhook(req, {
      serviceClient: () => db as never,
      getPayment: getPayment as never,
      verifySignature: verifySignature as never,
    });
    expect(getPayment).toHaveBeenCalledWith("APP_USR-token", "555");
  });

  it("busca a configuração só da loja da URL", async () => {
    await notify();
    expect(db.queries).toEqual([{ table: "store_payment_configs", filters: { store_id: "store-a" } }]);
  });
});
