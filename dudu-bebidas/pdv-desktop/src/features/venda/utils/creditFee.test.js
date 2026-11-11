import { describe, expect, it } from "vitest";
import { applyCreditCardFee } from "./creditFee";

describe("applyCreditCardFee (PDV)", () => {
  it("1x usa a taxa da maquininha", () => {
    expect(applyCreditCardFee(100, 1)).toBe(103.26);
  });
  it("parcelado usa a taxa da parcela", () => {
    expect(applyCreditCardFee(100, 3)).toBe(106.52);
  });
  it("tabela da loja tem prioridade", () => {
    expect(applyCreditCardFee(200, 1, { 1: 0.05 })).toBe(210);
  });
  it("mesmo resultado do site para o mesmo total", async () => {
    const site = await import("../../../../../src/features/checkout/checkoutConstants");
    expect(applyCreditCardFee(87.4, 1)).toBe(site.applyCreditCardFee(87.4, "credit_card", 1));
  });
});
