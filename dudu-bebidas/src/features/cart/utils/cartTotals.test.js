import { describe, expect, it } from "vitest";
import { calcCartTotals } from "./cartTotals";

const item = (preco, quantity = 1) => ({ preco, quantity });
const CENTRO = { nome: "Centro", frete: 5 };

describe("calcCartTotals", () => {
  it("soma preço × quantidade", () => {
    expect(calcCartTotals([item(5.5, 2), item(10)], null, null).subtotal).toBe(21);
  });

  it("soma sem erro de centavos (5,90 + 7,20 = 13,10)", () => {
    expect(calcCartTotals([item(5.9), item(7.2)], null, null).subtotal).toBe(13.1);
  });

  it("sem bairro escolhido: frete pendente e total = subtotal", () => {
    expect(calcCartTotals([item(20)], null, null)).toMatchObject({ frete: null, total: 20 });
  });

  it("com bairro: soma o frete", () => {
    expect(calcCartTotals([item(20)], CENTRO, null)).toMatchObject({ frete: 5, total: 25 });
  });

  it("acima do valor de frete grátis o frete zera", () => {
    expect(calcCartTotals([item(160)], CENTRO, 150)).toMatchObject({
      qualifiesForFreeShipping: true,
      frete: 0,
      total: 160,
      missingForFreeShipping: null,
    });
  });

  it("exatamente no valor já ganha frete grátis", () => {
    expect(calcCartTotals([item(150)], CENTRO, 150).frete).toBe(0);
  });

  it("abaixo do valor mostra quanto falta", () => {
    expect(calcCartTotals([item(120.5)], CENTRO, 150)).toMatchObject({
      frete: 5,
      missingForFreeShipping: 29.5,
    });
  });

  it.each([null, 0])("frete grátis desligado (%s) nunca zera o frete", (threshold) => {
    const totals = calcCartTotals([item(1000)], CENTRO, threshold);
    expect(totals.frete).toBe(5);
    expect(totals.missingForFreeShipping).toBeNull();
  });

  it("carrinho vazio", () => {
    expect(calcCartTotals([], null, 150)).toMatchObject({ subtotal: 0, total: 0, missingForFreeShipping: 150 });
  });
});
