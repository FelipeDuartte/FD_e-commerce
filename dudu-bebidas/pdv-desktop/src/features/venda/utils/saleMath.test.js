import { describe, expect, it } from "vitest";
import { calcChange, calcDiscount, calcSubtotal, summarizeSplit } from "./saleMath";

const item = (price, quantity = 1) => ({ price, quantity });

describe("calcSubtotal", () => {
  it("soma preço × quantidade em centavos exatos", () => {
    expect(calcSubtotal([item(5.9), item(7.2)])).toBe(13.1);
    expect(calcSubtotal([item(4.1, 3)])).toBe(12.3);
    expect(calcSubtotal([])).toBe(0);
  });
});

describe("calcDiscount", () => {
  it("em reais", () => {
    expect(calcDiscount(50, "amount", "5")).toBe(5);
  });

  it("em porcentagem, arredondado em centavos", () => {
    // 15% de 9,99 = 1,4985 → 1,50 (antes ficava 1,4985 e o total 8,4915)
    expect(calcDiscount(9.99, "percent", "15")).toBe(1.5);
  });

  it("nunca maior que o subtotal", () => {
    expect(calcDiscount(20, "amount", "50")).toBe(20);
    expect(calcDiscount(20, "percent", "150")).toBe(20);
  });

  it.each(["", "abc", "0", "-5"])("valor inválido (%s) = sem desconto", (input) => {
    expect(calcDiscount(20, "amount", input)).toBe(0);
  });
});

describe("calcChange", () => {
  it("troco certo", () => {
    expect(calcChange("50", 13.1)).toBe(36.9);
  });

  it("valor exato dá troco zero, não 'dinheiro insuficiente'", () => {
    // Bug: 5,90 + 7,20 somava 13,100000000000001 e R$ 13,10 recebidos davam troco negativo
    const total = calcSubtotal([item(5.9), item(7.2)]);
    expect(calcChange("13.10", total)).toBe(0);
  });

  it("valor menor dá troco negativo (falta dinheiro)", () => {
    expect(calcChange("10", 13.1)).toBe(-3.1);
  });

  it.each(["", "abc"])("sem valor válido (%s) = null", (input) => {
    expect(calcChange(input, 10)).toBeNull();
  });
});

describe("summarizeSplit", () => {
  it("divisão que fecha o total é válida", () => {
    const split = summarizeSplit([{ method: "cash", amount: "20" }, { method: "credit_card", amount: "13.10" }], 33.1);
    expect(split).toEqual({ paid: 33.1, remaining: 0, valid: true });
  });

  it("mostra quanto falta alocar", () => {
    const split = summarizeSplit([{ method: "cash", amount: "20" }, { method: "pix", amount: "" }], 33.1);
    expect(split).toMatchObject({ remaining: 13.1, valid: false });
  });

  it("precisa de pelo menos 2 formas", () => {
    expect(summarizeSplit([{ method: "cash", amount: "10" }], 10).valid).toBe(false);
  });

  it("toda linha precisa de forma e valor", () => {
    expect(summarizeSplit([{ method: "", amount: "5" }, { method: "pix", amount: "5" }], 10).valid).toBe(false);
  });

  it("centavos quebrados não impedem fechar (0,1 + 0,2 = 0,30)", () => {
    expect(summarizeSplit([{ method: "cash", amount: "0.1" }, { method: "pix", amount: "0.2" }], 0.3).valid).toBe(true);
  });
});
