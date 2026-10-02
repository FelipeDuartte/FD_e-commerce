import { useMemo, useState } from "react";
import { getPdvPrice } from "../utils/pricing";

// Itens do carrinho + desconto. Não sabe nada sobre forma de pagamento ou
// submissão da venda — só "o que está sendo vendido e por quanto".
//
// ignoreStockLimit: true tira o teto de "não deixa passar do estoque
// atual" — usado só pelo pedido fiado com baixa adiada criado na aba
// Clientes (NewFiadoOrderModal), onde o dono pode estar registrando um
// pedido pra entregar daqui a alguns dias, com mercadoria que ainda vai
// chegar do fornecedor. Faz sentido aí porque esse fluxo não baixa
// estoque na hora (só quando o pagamento cobrir o pedido, ver
// settle_fiado_stock) — a venda normal do balcão continua travada
// (default false), porque ali a baixa é imediata e vender mais do que
// existe seria overselling de verdade.
export function useCart({ ignoreStockLimit = false } = {}) {
  const [cart, setCart] = useState([]);
  const [discountMode, setDiscountMode] = useState("amount");
  const [discountInput, setDiscountInput] = useState("");

  const addToCart = (product) => {
    if (!ignoreStockLimit && product.stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        if (!ignoreStockLimit && existing.quantity >= product.stock) return prev;
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
        i.id === id
          ? { ...i, quantity: ignoreStockLimit ? Math.max(1, quantity) : Math.max(1, Math.min(quantity, i.stock)) }
          : i
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
