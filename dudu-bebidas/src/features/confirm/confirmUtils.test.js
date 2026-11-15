// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { resolveOrderData } from "./confirmUtils";

const ID = "8f3a2c1e-5b7d-4e91-a0c4-9d2e6f1b3a77";
const SAVED = { orderId: ID, orderNumber: 128, cartItems: [{ nome: "Coca", preco: 10, quantity: 1 }], payment: "cash" };

beforeEach(() => localStorage.clear());

describe("resolveOrderData", () => {
  it("vindo do checkout: usa o que veio", () => {
    expect(resolveOrderData({ orderId: "x", cartItems: [] }, "")).toEqual({ orderId: "x", cartItems: [] });
  });

  it("link do WhatsApp num navegador sem o pedido: só o código (o resto vem do servidor)", () => {
    expect(resolveOrderData(null, `?pedido=${ID}`)).toMatchObject({ orderId: ID, fromLink: true, payment: null, cartItems: [] });
  });

  it("link do WhatsApp no mesmo navegador da compra: dados completos", () => {
    localStorage.setItem("lastOrder", JSON.stringify(SAVED));
    expect(resolveOrderData(null, `?pedido=${ID}`)).toEqual(SAVED);
  });

  it("link de OUTRO pedido: não mistura com a compra salva", () => {
    localStorage.setItem("lastOrder", JSON.stringify({ ...SAVED, orderId: "outro" }));
    expect(resolveOrderData(null, `?pedido=${ID}`)).toMatchObject({ orderId: ID, fromLink: true });
  });

  it("código inválido no link é ignorado", () => {
    localStorage.setItem("lastOrder", JSON.stringify(SAVED));
    expect(resolveOrderData(null, "?pedido=128")).toEqual(SAVED);
  });

  it("recarregou a página: usa a compra salva", () => {
    localStorage.setItem("lastOrder", JSON.stringify(SAVED));
    expect(resolveOrderData(null, "")).toEqual(SAVED);
  });
});
