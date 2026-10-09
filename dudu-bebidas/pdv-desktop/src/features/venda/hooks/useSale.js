import { useCallback, useEffect, useMemo, useState } from "react";
import { formatBRL } from "../../../shared/utils/format";
import {
  createPdvSale,
  cancelPdvSale,
  removeSaleItem,
  listSessionSales,
  listSessionFiadoPayments,
} from "../../../shared/services/salesService";
import { applyCreditCardFee, DEFAULT_INSTALLMENT_FEE_RATE } from "../utils/creditFee";
import { useSaleRealtime } from "./useSaleRealtime";

const EMPTY_DELIVERY_ADDRESS = { name: "", street: "", number: "", complement: "", district: "", phone: "" };

// Forma de pagamento (única ou dividida), troco, cliente fiado, submissão
// da venda e cancelamento. Recebe o carrinho (de useCart) como dados —
// não é dono dele, só lê pra montar o payload e as mensagens de sucesso.
export function useSale(
  sessionId,
  { cart, cartTotal, discountAmount, clearCart, resetDiscount, reloadProducts },
  { onFiadoSale, installmentFeeRate = DEFAULT_INSTALLMENT_FEE_RATE } = {},
) {
  const [paymentMethod, setPaymentMethodRaw] = useState("cash");
  const [installments, setInstallments] = useState(1);
  const [receivedAmountInput, setReceivedAmountInput] = useState("");
  const [splitMode, setSplitMode] = useState(false);
  const [splitPayments, setSplitPayments] = useState([]);
  const [fiadoCustomer, setFiadoCustomer] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [saleError, setSaleError] = useState("");
  const [saleSuccess, setSaleSuccess] = useState("");
  const [sessionSales, setSessionSales] = useState([]);
  const [sessionFiadoPayments, setSessionFiadoPayments] = useState([]);
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelError, setCancelError] = useState("");
  const [confirmingSale, setConfirmingSale] = useState(null);
  const [itemToRemove, setItemToRemove] = useState(null);
  const [removingItem, setRemovingItem] = useState(false);
  const [removeItemError, setRemoveItemError] = useState("");

  // Venda que precisa ir pro endereço do cliente em vez de ser retirada no
  // balcão — guarda o endereço junto do pedido (orders.address, mesma
  // coluna já usada pelo site) só pra aparecer no Histórico e na notinha
  // impressa pro entregador. Não entra no sistema de rastreamento de
  // entrega do site (sem atribuir entregador, sem mapa).
  const [isDelivery, setIsDeliveryRaw] = useState(false);
  const [deliveryAddress, setDeliveryAddressRaw] = useState(EMPTY_DELIVERY_ADDRESS);

  const loadSessionSales = useCallback(async (id) => {
    if (!id) {
      setSessionSales([]);
      setSessionFiadoPayments([]);
      return;
    }
    try {
      const [sales, payments] = await Promise.all([listSessionSales(id), listSessionFiadoPayments(id)]);
      setSessionSales(sales);
      setSessionFiadoPayments(payments);
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

  // Recarrega quando QUALQUER terminal (inclusive outro computador) vende
  // ou cancela algo nesse mesmo caixa — não só quando este terminal age.
  const handleRealtimeChange = useCallback(() => {
    loadSessionSales(sessionId);
  }, [sessionId, loadSessionSales]);
  useSaleRealtime(sessionId, handleRealtimeChange);

  // Troco só faz sentido pra dinheiro, cliente só faz sentido pra fiado,
  // parcelas só fazem sentido pra crédito — trocar de forma de pagamento
  // limpa os três, senão sobraria algo selecionado pra uma forma que não
  // usa mais aquilo.
  const setPaymentMethod = (method) => {
    setPaymentMethodRaw(method);
    setReceivedAmountInput("");
    setFiadoCustomer(null);
    setInstallments(1);
  };

  // Desligar "Entrega" limpa o endereço — senão sobraria preenchido pra
  // uma venda que virou retirada no balcão.
  const setIsDelivery = (value) => {
    setIsDeliveryRaw(value);
    if (!value) setDeliveryAddressRaw(EMPTY_DELIVERY_ADDRESS);
  };

  const setDeliveryAddressField = (field, value) => {
    setDeliveryAddressRaw((prev) => ({ ...prev, [field]: value }));
  };

  // Total da venda já com a taxa da maquininha embutida quando for crédito
  // (parcelado ou não) — é esse valor que vai pro servidor e pro recibo.
  const saleTotal = useMemo(
    () => (paymentMethod === "credit_card" ? applyCreditCardFee(cartTotal, installments, installmentFeeRate) : cartTotal),
    [paymentMethod, cartTotal, installments, installmentFeeRate],
  );
  const cardFeeAmount = useMemo(() => Math.round((saleTotal - cartTotal) * 100) / 100, [saleTotal, cartTotal]);

  const changeAmount = useMemo(() => {
    if (paymentMethod !== "cash" || receivedAmountInput === "") return null;
    const received = Number(receivedAmountInput);
    if (!Number.isFinite(received)) return null;
    return received - cartTotal;
  }, [paymentMethod, receivedAmountInput, cartTotal]);

  const insufficientCash = paymentMethod === "cash" && changeAmount !== null && changeAmount < 0;
  const missingFiadoCustomer = paymentMethod === "fiado" && !fiadoCustomer;
  // Bairro é livre e opcional aqui — a limitação de bairros atendidos é
  // só do site (área de entrega online). No balcão o dono decide na hora
  // se entrega ou não, então só rua e número são obrigatórios.
  const missingDeliveryAddress =
    isDelivery && (!deliveryAddress.street.trim() || !deliveryAddress.number.trim());

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

  const handleFinalizeSale = async () => {
    if (cart.length === 0 || !sessionId) return;
    if (splitMode ? !splitValid : insufficientCash || missingFiadoCustomer) return;
    if (missingDeliveryAddress) return;
    setSubmitting(true);
    setSaleError("");
    try {
      const { orderNumber } = await createPdvSale({
        cartItems: cart.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, usePromoPrice: i.usePromoPrice })),
        cashSessionId: sessionId,
        discountAmount,
        ...(splitMode
          ? { payments: splitPayments.map((p) => ({ method: p.method, amount: Number(p.amount) })) }
          : {
              paymentMethod,
              pdvCustomerId: paymentMethod === "fiado" ? fiadoCustomer.id : undefined,
              installments: paymentMethod === "credit_card" ? installments : undefined,
            }),
        ...(isDelivery
          ? {
              address: {
                name: deliveryAddress.name.trim() || null,
                street: deliveryAddress.street.trim(),
                number: deliveryAddress.number.trim(),
                complement: deliveryAddress.complement.trim() || null,
                district: deliveryAddress.district.trim() || null,
                phone: deliveryAddress.phone.trim() || null,
              },
            }
          : {}),
      });
      const orderTag = orderNumber ? `Pedido #${orderNumber} — ` : "";
      setSaleSuccess(
        paymentMethod === "fiado"
          ? `${orderTag}Venda fiado registrada — ${formatBRL(cartTotal)} (${fiadoCustomer.name})`
          : paymentMethod === "credit_card" && installments > 1
            ? `${orderTag}Venda registrada — ${formatBRL(saleTotal)} (${installments}x, taxa: ${formatBRL(cardFeeAmount)})`
            : changeAmount !== null
              ? `${orderTag}Venda registrada — ${formatBRL(saleTotal)} (troco: ${formatBRL(changeAmount)})`
              : `${orderTag}Venda registrada — ${formatBRL(saleTotal)}`,
      );
      setTimeout(() => setSaleSuccess(""), 3000);
      if (paymentMethod === "fiado") onFiadoSale?.();
      clearCart();
      setPaymentMethod("cash");
      resetDiscount();
      setSplitMode(false);
      setSplitPayments([]);
      setIsDelivery(false);
      reloadProducts();
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

  // Remover um item específico de um pedido fiado ("Em Aberto") — pra não
  // precisar cancelar o pedido inteiro e lançar tudo de novo quando só um
  // item foi registrado errado (ver migration 0035, remove_pdv_sale_item).
  const handleRemoveItem = (sale, item) => {
    setRemoveItemError("");
    setItemToRemove({ sale, item });
  };

  const dismissRemoveItem = () => setItemToRemove(null);

  const confirmRemoveItem = async () => {
    if (!itemToRemove) return;
    const { sale, item } = itemToRemove;
    setRemovingItem(true);
    setRemoveItemError("");
    try {
      await removeSaleItem(sale.orderId, item.id);
      reloadProducts();
      loadSessionSales(sessionId);
      setItemToRemove(null);
    } catch (e) {
      setRemoveItemError(e.message);
    }
    setRemovingItem(false);
  };

  const confirmCancelSale = async () => {
    const sale = confirmingSale;
    if (!sale) return;
    setCancellingId(sale.orderId);
    setCancelError("");
    try {
      await cancelPdvSale(sale.orderId);
      reloadProducts();
      loadSessionSales(sessionId);
    } catch (e) {
      setCancelError(e.message);
    }
    setCancellingId(null);
    setConfirmingSale(null);
  };

  return {
    paymentMethod, setPaymentMethod, installments, setInstallments, saleTotal, cardFeeAmount,
    submitting, saleError, saleSuccess,
    sessionSales, sessionFiadoPayments, cancellingId, cancelError, confirmingSale,
    receivedAmountInput, setReceivedAmountInput, changeAmount, insufficientCash,
    splitMode, toggleSplitMode, splitPayments, updateSplitLine, addSplitLine,
    removeSplitLine, splitTotal, splitRemaining, splitValid,
    fiadoCustomer, setFiadoCustomer, missingFiadoCustomer,
    isDelivery, setIsDelivery, deliveryAddress, setDeliveryAddressField, missingDeliveryAddress,
    handleFinalizeSale, handleCancelSale, confirmCancelSale, dismissCancelSale,
    itemToRemove, removingItem, removeItemError,
    handleRemoveItem, confirmRemoveItem, dismissRemoveItem,
  };
}
