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
        return prev.map((item) =>
          item.id === produto.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...produto, quantity: 1 }];
    });
  };

  const updateQuantity = (id, quantity) => {
    if (quantity < 1) return;
    setCartItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item))
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
    [cartItems]
  );

  return { cartItems, cartCount, addToCart, updateQuantity, removeItem, clearCart };
}