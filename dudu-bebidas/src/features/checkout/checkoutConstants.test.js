import { describe, expect, it } from "vitest";
import { applyCreditCardFee, DEFAULT_INSTALLMENT_FEE_RATE, roundCents } from "./checkoutConstants";

describe("applyCreditCardFee (site)", () => {
  it("só crédito tem taxa", () => {
    for (const payment of ["pix", "debit_card", "cash", "pix_entrega"]) {
      expect(applyCreditCardFee(100, payment, 1)).toBe(100);
    }
  });

  it("crédito à vista usa a taxa de 1x", () => {
    expect(applyCreditCardFee(100, "credit_card", 1)).toBe(103.26);
  });

  it("usa a tabela da loja quando vem do banco", () => {
    expect(applyCreditCardFee(100, "credit_card", 2, { 2: 0.1 })).toBe(110);
  });

  it("parcela sem taxa cadastrada não cobra taxa", () => {
    expect(applyCreditCardFee(100, "credit_card", 12)).toBe(100);
  });

  it("arredonda em centavos", () => {
    expect(applyCreditCardFee(33.33, "credit_card", 1)).toBe(roundCents(33.33 * (1 + DEFAULT_INSTALLMENT_FEE_RATE[1])));
    expect(String(applyCreditCardFee(33.33, "credit_card", 1)).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(2);
  });
});
