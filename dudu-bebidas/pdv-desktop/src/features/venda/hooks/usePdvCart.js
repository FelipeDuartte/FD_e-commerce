import { useCallback, useEffect, useMemo, useState } from "react";
import { formatBRL } from "../../../shared/utils/format";
import { listAdminProducts } from "../../produtos/services/productService";
import {
  createPdvSale,
  cancelPdvSale,
  listSessionSales,
} from "../../../shared/services/salesService";
import { getPdvPrice } from "../../../constants";

export function usePdvCart(sessionId, { onFiadoSale } = {}) {
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [search, setSearch] = useState("");

  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethodRaw] = useState("cash");
  const [receivedAmountInput, setReceivedAmountInput] = useState("");
  const [splitMode, setSplitMode] = useState(false);
  const [splitPayments, setSplitPayments] = useState([]);
  const [fiadoCustomer, setFiadoCustomer] = useState(null);
  const [discountMode, setDiscountMode] = useState("amount");
  const [discountInput, setDiscountInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saleError, setSaleError] = useState("");
  const [saleSuccess, setSaleSuccess] = useState("");
  const [sessionSales, setSessionSales] = useState([]);
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelError, setCancelError] = useState("");
  const [confirmingSale, setConfirmingSale] = useState(null);

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

  // Troco só faz sentido pra dinheiro, cliente só faz sentido pra fiado —
  // trocar de forma de pagamento limpa os dois, senão sobraria um valor
  // ou cliente selecionado pra uma forma que não usa mais aquilo.
  const setPaymentMethod = (method) => {
    setPaymentMethodRaw(method);
    setReceivedAmountInput("");
    setFiadoCustomer(null);
  };

  const changeAmount = useMemo(() => {
    if (paymentMethod !== "cash" || receivedAmountInput === "") return null;
    const received = Number(receivedAmountInput);
    if (!Number.isFinite(received)) return null;
    return received - cartTotal;
  }, [paymentMethod, receivedAmountInput, cartTotal]);

  const insufficientCash = paymentMethod === "cash" && changeAmount !== null && changeAmount < 0;
  const missingFiadoCustomer = paymentMethod === "fiado" && !fiadoCustomer;

  // Pagamento dividido — ex: parte em dinheiro, parte no cartão. Ligar/desligar
  // reseta as linhas (senão sobraria um valor dividido pra uma venda que virou
  // pagamento único, ou vice-versa).
  const toggleSplitMode = () => {
    setSplitMode((prev) => {
      const next = !prev;
      setSplitPayments(next ? [{ method: "cash", amount: "" }, { method: "credit_card", amount: "" }] : []);
      return next;
    });
  };

  const updateSplitLine = (index, field, value) => {
    setSplitPayments((prev) => prev.map((line, i) => (i === index ? { ...line, [field]: value } : line)));
  };

  const addSplitLine = () => {
    setSplitPayments((prev) => [...prev, { method: "cash", amount: "" }]);
  };

  const removeSplitLine = (index) => {
    setSplitPayments((prev) => prev.filter((_, i) => i !== index));
  };

  const splitTotal = useMemo(
    () => splitPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [splitPayments],
  );

  const splitRemaining = useMemo(() => Math.round((cartTotal - splitTotal) * 100) / 100, [cartTotal, splitTotal]);

  const splitValid =
    splitPayments.length >= 2 &&
    splitPayments.every((p) => p.method && Number(p.amount) > 0) &&
    Math.abs(splitRemaining) < 0.01;

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
    if (splitMode ? !splitValid : insufficientCash || missingFiadoCustomer) return;
    setSubmitting(true);
    setSaleError("");
    try {
      const { orderNumber } = await createPdvSale({
        cartItems: cart.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity })),
        cashSessionId: sessionId,
        discountAmount,
        ...(splitMode
          ? { payments: splitPayments.map((p) => ({ method: p.method, amount: Number(p.amount) })) }
          : { paymentMethod, pdvCustomerId: paymentMethod === "fiado" ? fiadoCustomer.id : undefined }),
      });
      const orderTag = orderNumber ? `Pedido #${orderNumber} — ` : "";
      setSaleSuccess(
        paymentMethod === "fiado"
          ? `${orderTag}Venda fiado registrada — ${formatBRL(cartTotal)} (${fiadoCustomer.name})`
          : changeAmount !== null
            ? `${orderTag}Venda registrada — ${formatBRL(cartTotal)} (troco: ${formatBRL(changeAmount)})`
            : `${orderTag}Venda registrada — ${formatBRL(cartTotal)}`,
      );
      setTimeout(() => setSaleSuccess(""), 3000);
      if (paymentMethod === "fiado") onFiadoSale?.();
      clearCart();
      setPaymentMethod("cash");
      setDiscountInput("");
      setSplitMode(false);
      setSplitPayments([]);
      loadProducts();
      loadSessionSales(sessionId);
    } catch (e) {
      setSaleError(e.message);
    }
    setSubmitting(false);
  };

  // window.confirm() não abre diálogo nenhum dentro do WebView do Tauri —
  // por isso a confirmação de cancelamento precisa ser um modal próprio em
  // vez do confirm() nativo do navegador (ver CancelSaleModal).
  const handleCancelSale = (sale) => {
    if (sale.cancelled) return;
    setCancelError("");
    setConfirmingSale(sale);
  };

  const dismissCancelSale = () => setConfirmingSale(null);

  const confirmCancelSale = async () => {
    const sale = confirmingSale;
    if (!sale) return;
    setCancellingId(sale.orderId);
    setCancelError("");
    try {
      await cancelPdvSale(sale.orderId);
      loadProducts();
      loadSessionSales(sessionId);
    } catch (e) {
      setCancelError(e.message);
    }
    setCancellingId(null);
    setConfirmingSale(null);
  };

  return {
    products, productsLoading, productsError, search, setSearch,
    cart, paymentMethod, setPaymentMethod, discountMode, setDiscountMode,
    discountInput, setDiscountInput, submitting, saleError, saleSuccess,
    sessionSales, cancellingId, cancelError, confirmingSale,
    receivedAmountInput, setReceivedAmountInput, changeAmount, insufficientCash,
    splitMode, toggleSplitMode, splitPayments, updateSplitLine, addSplitLine,
    removeSplitLine, splitTotal, splitRemaining, splitValid,
    fiadoCustomer, setFiadoCustomer, missingFiadoCustomer,
    addToCart, updateQuantity, removeFromCart,
    subtotal, discountAmount, cartTotal, filteredProducts,
    handleFinalizeSale, handleCancelSale, confirmCancelSale, dismissCancelSale,
  };
}
