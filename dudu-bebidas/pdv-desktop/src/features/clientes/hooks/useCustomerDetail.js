import { useCallback, useEffect, useMemo, useState } from "react";
import { listFiadoOrders, listCustomerPayments } from "../services/fiadoService";

// Pedidos fiado + pagamentos do cliente selecionado, e a lista unificada de
// transações (compra + pagamento) com filtro próprio. Também resolve quais
// pedidos já foram pagos via FIFO — não existe vínculo direto entre um
// pagamento e um pedido específico (fiado é conta corrente, não fatura por
// fatura), então assume que o cliente sempre quita a venda mais antiga primeiro.
export function useCustomerDetail(customerId, selectedCustomer) {
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  const [txFilter, setTxFilter] = useState("todas");

  const loadDetail = useCallback(async (id) => {
    if (!id) {
      setOrders([]);
      setPayments([]);
      return;
    }
    setOrdersLoading(true);
    try {
      const [o, p] = await Promise.all([listFiadoOrders(id), listCustomerPayments(id)]);
      setOrders(o);
      setPayments(p);
    } catch {
      setOrders([]);
      setPayments([]);
    }
    setOrdersLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDetail(customerId);
      setTxFilter("todas");
    }, 0);
    return () => clearTimeout(timer);
  }, [customerId, loadDetail]);

  const paidOrderIds = useMemo(() => {
    const totalPaid = selectedCustomer?.totalPaid ?? 0;
    const oldestFirst = orders
      .filter((o) => !o.cancelled)
      .slice()
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const paid = new Set();
    let remaining = totalPaid;
    for (const o of oldestFirst) {
      if (remaining < o.total - 0.005) break;
      paid.add(o.orderId);
      remaining -= o.total;
    }
    return paid;
  }, [orders, selectedCustomer]);

  const transactions = useMemo(() => {
    const compras = orders.map((o) => ({ type: "compra", key: `o-${o.orderId}`, ...o }));
    const pagamentos = payments.map((p) => ({ type: "pagamento", key: `p-${p.id}`, ...p }));
    return [...compras, ...pagamentos].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [orders, payments]);

  const filteredTransactions = useMemo(() => {
    if (txFilter === "compras") return transactions.filter((t) => t.type === "compra" && !t.cancelled);
    if (txFilter === "pagamentos") return transactions.filter((t) => t.type === "pagamento");
    if (txFilter === "canceladas") return transactions.filter((t) => t.type === "compra" && t.cancelled);
    return transactions;
  }, [transactions, txFilter]);

  return {
    orders, ordersLoading, txFilter, setTxFilter,
    paidOrderIds, transactions, filteredTransactions,
  };
}
