// src/hooks/useCart.js
import { useState, useEffect, useMemo } from "react";

export function useCart() {
  // ── Persiste no localStorage ──────────────────────
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem("dudu-cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("dudu-cart", JSON.stringify(cartItems));
  }, [cartItems]);

  // ── Handlers ──────────────────────────────────────
  const addToCart = (produto) => {
    setCartItems((prev) => {
      const exists = prev.find((item) => item.id === produto.id);
      if (exists) {
        // Valida se não ultrapassa o estoque disponível
        const novaQuantidade = Math.min(exists.quantity + 1, produto.estoque);
        return prev.map((item) =>
          item.id === produto.id ? { ...item, quantity: novaQuantidade } : item,
        );
      }
      // Quando adiciona novo item, limita à quantidade em estoque
      return [...prev, { ...produto, quantity: Math.min(1, produto.estoque) }];
    });
  };

  const updateQuantity = (id, quantity) => {
    if (quantity < 1) return;
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          // Valida que não ultrapassa o estoque
          const quantidadeMaxima = item.estoque || 999;
          const novaQuantidade = Math.min(quantity, quantidadeMaxima);
          return { ...item, quantity: novaQuantidade };
        }
        return item;
      }),
    );
  };

  const removeItem = (id) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCartItems([]);
    localStorage.removeItem("dudu-cart");
  };

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems],
  );

  return {
    cartItems,
    cartCount,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
  };
}
