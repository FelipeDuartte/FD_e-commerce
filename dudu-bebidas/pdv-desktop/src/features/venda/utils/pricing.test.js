import { describe, expect, it } from "vitest";
import { getPdvPrice, getPdvPromoPrice } from "./pricing";

describe("preço no balcão", () => {
  it("promoção do site NÃO vale no balcão (usa o preço cheio)", () => {
    expect(getPdvPrice({ price: 8, old_price: 10, promotion: true })).toBe(10);
  });
  it("sem promoção usa o preço normal", () => {
    expect(getPdvPrice({ price: 8, old_price: null, promotion: false })).toBe(8);
  });
  it("promoção marcada sem preço antigo usa o preço normal", () => {
    expect(getPdvPrice({ price: 8, old_price: null, promotion: true })).toBe(8);
  });
  it("promoção do PDV é separada", () => {
    expect(getPdvPromoPrice({ pdv_promo_price: "7.50" })).toBe(7.5);
    expect(getPdvPromoPrice({ pdv_promo_price: null })).toBeNull();
  });
});
