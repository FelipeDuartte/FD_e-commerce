import { useMemo, useState } from "react";
import { getPdvPrice } from "../utils/pricing";

// Itens do carrinho + desconto. Não sabe nada sobre forma de pagamento ou
// submissão da venda — só "o que está sendo vendido e por quanto".
export function useCart() {
  const [cart, setCart] = useState([]);
  const [discountMode, setDiscountMode] = useState("amount");
  const [discountInput, setDiscountInput] = useState("");

  const addToCart = (product) => {
    if (product.stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((i) =>
          i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        { id: product.id, name: product.name, price: getPdvPrice(product), quantity: 1, stock: product.stock },
      ];
    });
  };

  const updateQuantity = (id, quantity) => {
    setCart((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, quantity: Math.max(1, Math.min(quantity, i.stock)) } : i
      )
    );
  };

  const removeFromCart = (id) => setCart((prev) => prev.filter((i) => i.id !== id));
  const clearCart = () => setCart([]);

  const subtotal = useMemo(
    () => cart.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [cart]
  );

  const discountAmount = useMemo(() => {
    const raw = Number(discountInput);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    const amount = discountMode === "percent" ? subtotal * (raw / 100) : raw;
    return Math.min(Math.max(0, amount), subtotal);
  }, [discountInput, discountMode, subtotal]);

  const cartTotal = subtotal - discountAmount;

  return {
    cart, addToCart, updateQuantity, removeFromCart, clearCart,
    discountMode, setDiscountMode, discountInput, setDiscountInput,
    subtotal, discountAmount, cartTotal,
  };
}
