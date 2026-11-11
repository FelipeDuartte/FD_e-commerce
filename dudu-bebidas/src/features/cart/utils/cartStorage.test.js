import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearStoredCart, loadStoredCart, saveStoredCart } from "./cartStorage";

// localStorage de mentira (os testes rodam em Node, sem navegador)
function fakeLocalStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    data,
  };
}

let storage;
beforeEach(() => {
  storage = fakeLocalStorage();
  vi.stubGlobal("localStorage", storage);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("carrinho salvo no navegador", () => {
  it("sem nada salvo começa vazio", () => {
    expect(loadStoredCart()).toEqual([]);
  });

  it("salva e recupera os itens", () => {
    const items = [{ id: 1, preco: 5.5, quantity: 2 }];
    saveStoredCart(items);
    expect(loadStoredCart()).toEqual(items);
  });

  it("dado corrompido é descartado (e apagado)", () => {
    storage.setItem("dudu-cart", "{quebrado");
    expect(loadStoredCart()).toEqual([]);
    expect(storage.data.has("dudu-cart")).toBe(false);
  });

  it("dado que não é lista vira carrinho vazio", () => {
    storage.setItem("dudu-cart", JSON.stringify({ id: 1 }));
    expect(loadStoredCart()).toEqual([]);
  });

  it("navegador sem espaço não quebra a tela", () => {
    storage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    expect(() => saveStoredCart([{ id: 1 }])).not.toThrow();
  });

  it("limpar apaga o carrinho salvo", () => {
    saveStoredCart([{ id: 1 }]);
    clearStoredCart();
    expect(loadStoredCart()).toEqual([]);
  });
});
