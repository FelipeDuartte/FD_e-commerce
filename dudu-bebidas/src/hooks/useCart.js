// src/hooks/useCart.js
import { useState, useEffect, useMemo } from "react";
import {
  clearStoredCart,
  loadStoredCart,
  saveStoredCart,
} from "../utils/cartStorage";

export function useCart() {
  // ── Persiste no localStorage ──────────────────────
  const [cartItems, setCartItems] = useState(loadStoredCart);

  useEffect(() => {
    saveStoredCart(cartItems);
  }, [cartItems]);

  // ── Sincroniza preços e estoques quando os produtos carregam ──
  useEffect(() => {
    const syncStock = (e) => {
      const products = e.detail;
      setCartItems((prev) =>
        prev
          .map((item) => {
            const product = products.find((p) => p.id === item.id);
            // Remove item se produto foi desativado ou não existe mais
            if (!product) return null;
            // Atualiza preço e limita quantidade ao estoque atual
            return {
              ...item,
              price: product.preco,
              quantity: Math.min(item.quantity, product.estoque),
            };
          })
          .filter(Boolean),
      );
    };
    window.addEventListener("products-loaded", syncStock);
    return () => window.removeEventListener("products-loaded", syncStock);
  }, []);

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
    clearStoredCart();
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
