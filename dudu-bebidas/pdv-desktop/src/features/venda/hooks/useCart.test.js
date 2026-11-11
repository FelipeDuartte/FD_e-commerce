// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCart } from "./useCart";

const product = (overrides = {}) => ({
  id: "p1",
  name: "Brahma 600ml",
  price: 7.9, // preço promocional do site
  old_price: 8.5, // preço de tabela (o que o balcão cobra)
  promotion: true,
  pdv_promo_price: 7.5,
  stock: 2,
  ...overrides,
});

const setup = (options) => renderHook(() => useCart(options)).result;

describe("useCart (PDV)", () => {
  it("cobra o preço de tabela do balcão, não a promoção do site", () => {
    const cart = setup();
    act(() => cart.current.addToCart(product()));
    expect(cart.current.cart[0]).toMatchObject({ price: 8.5, quantity: 1, usePromoPrice: false });
  });

  it("promoção do PDV só quando o operador escolhe — e vai marcada pro servidor", () => {
    const cart = setup();
    act(() => cart.current.addToCart(product(), { usePromoPrice: true }));
    expect(cart.current.cart[0]).toMatchObject({ price: 7.5, usePromoPrice: true });
  });

  it("adicionar de novo soma a quantidade até o estoque", () => {
    const cart = setup();
    act(() => cart.current.addToCart(product()));
    act(() => cart.current.addToCart(product()));
    act(() => cart.current.addToCart(product())); // estoque é 2
    expect(cart.current.cart[0].quantity).toBe(2);
  });

  it("produto sem estoque não entra", () => {
    const cart = setup();
    act(() => cart.current.addToCart(product({ stock: 0 })));
    expect(cart.current.cart).toEqual([]);
  });

  it("pedido fiado com baixa adiada pode passar do estoque", () => {
    const cart = setup({ ignoreStockLimit: true });
    act(() => cart.current.addToCart(product({ stock: 0 })));
    act(() => cart.current.updateQuantity("p1", 10));
    expect(cart.current.cart[0].quantity).toBe(10);
  });

  it("quantidade digitada fica entre 1 e o estoque", () => {
    const cart = setup();
    act(() => cart.current.addToCart(product()));
    act(() => cart.current.updateQuantity("p1", 50));
    expect(cart.current.cart[0].quantity).toBe(2);
    act(() => cart.current.updateQuantity("p1", 0));
    expect(cart.current.cart[0].quantity).toBe(1);
  });

  it("subtotal, desconto em % e total em centavos exatos", () => {
    const cart = setup();
    act(() => cart.current.addToCart(product({ id: "a", old_price: 5.9, stock: 9 })));
    act(() => cart.current.addToCart(product({ id: "b", old_price: 7.2, stock: 9 })));
    act(() => {
      cart.current.setDiscountMode("percent");
      cart.current.setDiscountInput("15");
    });
    expect(cart.current.subtotal).toBe(13.1);
    expect(cart.current.discountAmount).toBe(1.97); // 15% de 13,10 = 1,965 → 1,97
    expect(cart.current.cartTotal).toBe(11.13);
  });

  it("remover e limpar", () => {
    const cart = setup();
    act(() => cart.current.addToCart(product({ id: "a" })));
    act(() => cart.current.addToCart(product({ id: "b" })));
    act(() => cart.current.removeFromCart("a"));
    expect(cart.current.cart.map((i) => i.id)).toEqual(["b"]);
    act(() => cart.current.clearCart());
    expect(cart.current.cart).toEqual([]);
  });
});
