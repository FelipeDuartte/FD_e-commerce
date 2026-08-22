import { useCallback, useEffect, useMemo, useState } from "react";
import { formatBRL } from "../../adminUtils";
import { listAdminProducts } from "../../services/adminProductService";
import {
  createPdvSale,
  cancelPdvSale,
  listSessionSales,
} from "../../services/adminPDVService";

// Concentra catálogo/busca, carrinho, desconto e o histórico de vendas da
// sessão atual. Recebe sessionId (id do caixa aberto, ou null) — troca de
// sessão (abrir/fechar caixa) recarrega o histórico automaticamente.
export function usePdvCart(sessionId) {
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [search, setSearch] = useState("");

  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [discountMode, setDiscountMode] = useState("amount"); // "amount" (R$) | "percent" (%)
  const [discountInput, setDiscountInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saleError, setSaleError] = useState("");
  const [saleSuccess, setSaleSuccess] = useState("");
  const [sessionSales, setSessionSales] = useState([]);
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelError, setCancelError] = useState("");

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      setProducts(await listAdminProducts());
      setProductsError("");
    } catch (e) {
      setProductsError(e.message);
    }
    setProductsLoading(false);
  }, []);

  // Busca do banco (não acumula localmente) — assim sobrevive a reload da
  // página enquanto o caixa continuar aberto, em vez de ser só um contador
  // que se perde se a aba recarregar.
  const loadSessionSales = useCallback(async (id) => {
    if (!id) {
      setSessionSales([]);
      return;
    }
    try {
      setSessionSales(await listSessionSales(id));
    } catch (e) {
      setCancelError(e.message);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSessionSales(sessionId);
      // Caixa acabou de fechar (sessionId virou null) — mesmo reset que o
      // fechamento de caixa fazia no monólito original.
      if (!sessionId) setCancelError("");
    }, 0);
    return () => clearTimeout(timer);
  }, [sessionId, loadSessionSales]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadProducts]);

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
        { id: product.id, name: product.name, price: product.price, quantity: 1, stock: product.stock },
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

  // Desconto que o atendente decide dar (venda de balcão não tem o mesmo
  // desconto do site) — clampado aqui só pra exibição; a validação real
  // acontece no servidor, que nunca confia nesse valor.
  const discountAmount = useMemo(() => {
    const raw = Number(discountInput);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    const amount = discountMode === "percent" ? subtotal * (raw / 100) : raw;
    return Math.min(Math.max(0, amount), subtotal);
  }, [discountInput, discountMode, subtotal]);

  const cartTotal = subtotal - discountAmount;

  // ── Busca de produto (nome, código de barras ou id) ─
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products
      .filter((p) => p.is_active && p.stock > 0)
      .filter(
        (p) =>
          !term ||
          p.name.toLowerCase().includes(term) ||
          p.id.toLowerCase().includes(term) ||
          (p.ean ?? "").toLowerCase() === term
      );
  }, [products, search]);

  const handleFinalizeSale = async () => {
    if (cart.length === 0 || !sessionId) return;
    setSubmitting(true);
    setSaleError("");
    try {
      await createPdvSale({
        cartItems: cart.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity })),
        paymentMethod,
        cashSessionId: sessionId,
        discountAmount,
      });
      setSaleSuccess(`Venda registrada — ${formatBRL(cartTotal)}`);
      setTimeout(() => setSaleSuccess(""), 3000);
      clearCart();
      setPaymentMethod("cash");
      setDiscountInput("");
      loadProducts(); // estoque mudou, recarrega pra não deixar badge desatualizado
      loadSessionSales(sessionId); // busca do banco — pega a venda que acabou de ser criada
    } catch (e) {
      setSaleError(e.message);
    }
    setSubmitting(false);
  };

  const handleCancelSale = async (sale) => {
    if (sale.cancelled) return;
    if (!window.confirm(`Cancelar a venda de ${formatBRL(sale.total)}? O estoque volta automaticamente.`)) return;
    setCancellingId(sale.orderId);
    setCancelError("");
    try {
      await cancelPdvSale(sale.orderId);
      loadProducts(); // estoque voltou, recarrega
      loadSessionSales(sessionId); // busca do banco — pega o novo status "cancelled"
    } catch (e) {
      setCancelError(e.message);
    }
    setCancellingId(null);
  };

  return {
    products, productsLoading, productsError, search, setSearch,
    cart, paymentMethod, setPaymentMethod, discountMode, setDiscountMode,
    discountInput, setDiscountInput, submitting, saleError, saleSuccess,
    sessionSales, cancellingId, cancelError,
    addToCart, updateQuantity, removeFromCart,
    subtotal, discountAmount, cartTotal, filteredProducts,
    handleFinalizeSale, handleCancelSale,
  };
}
