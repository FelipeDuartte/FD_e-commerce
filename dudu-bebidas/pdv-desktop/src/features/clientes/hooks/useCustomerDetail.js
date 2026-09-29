import { useCallback, useEffect, useMemo, useState } from "react";
import { listFiadoOrders, listCustomerPayments, listCustomerCharges } from "../services/fiadoService";
import { useCustomerDetailRealtime } from "./useFiadoRealtime";

// Pedidos fiado + lançamentos livres (pedido em aberto manual) + pagamentos
// do cliente selecionado, e a lista unificada de transações (compra/cobrança
// + pagamento) com filtro próprio. Também resolve quais dívidas (pedido ou
// lançamento manual) já foram pagas via FIFO — não existe vínculo direto
// entre um pagamento e uma dívida específica (fiado é conta corrente, não
// fatura por fatura), então assume que o cliente sempre quita a mais velha
// primeiro, seja ela um pedido ou um lançamento manual.
export function useCustomerDetail(customerId, selectedCustomer) {
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  const [charges, setCharges] = useState([]);
  const [txFilter, setTxFilter] = useState("todas");

  const loadDetail = useCallback(async (id) => {
    if (!id) {
      setOrders([]);
      setPayments([]);
      setCharges([]);
      return;
    }
    setOrdersLoading(true);
    try {
      const [o, p, c] = await Promise.all([listFiadoOrders(id), listCustomerPayments(id), listCustomerCharges(id)]);
      setOrders(o);
      setPayments(p);
      setCharges(c);
    } catch {
      setOrders([]);
      setPayments([]);
      setCharges([]);
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

  const reload = useCallback(() => loadDetail(customerId), [customerId, loadDetail]);

  // Recarrega quando outro terminal registra pagamento/cobrança/venda
  // fiado pra ESTE cliente, enquanto a tela dele está aberta.
  useCustomerDetailRealtime(customerId, reload);

  const paidDebitIds = useMemo(() => {
    const totalPaid = selectedCustomer?.totalPaid ?? 0;
    const oldestFirst = [
      ...orders.filter((o) => !o.cancelled).map((o) => ({ id: o.orderId, total: o.total, createdAt: o.createdAt })),
      ...charges.map((c) => ({ id: c.id, total: c.amount, createdAt: c.createdAt })),
    ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const paid = new Set();
    let remaining = totalPaid;
    for (const d of oldestFirst) {
      if (remaining < d.total - 0.005) break;
      paid.add(d.id);
      remaining -= d.total;
    }
    return paid;
  }, [orders, charges, selectedCustomer]);

  const transactions = useMemo(() => {
    const compras = orders.map((o) => ({ type: "compra", key: `o-${o.orderId}`, ...o }));
    const cobrancas = charges.map((c) => ({ type: "cobranca", key: `c-${c.id}`, ...c }));
    const pagamentos = payments.map((p) => ({ type: "pagamento", key: `p-${p.id}`, ...p }));
    return [...compras, ...cobrancas, ...pagamentos].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [orders, charges, payments]);

  const filteredTransactions = useMemo(() => {
    if (txFilter === "compras") return transactions.filter((t) => (t.type === "compra" || t.type === "cobranca") && !t.cancelled);
    if (txFilter === "pagamentos") return transactions.filter((t) => t.type === "pagamento");
    if (txFilter === "canceladas") return transactions.filter((t) => t.type === "compra" && t.cancelled);
    return transactions;
  }, [transactions, txFilter]);

  return {
    orders, ordersLoading, txFilter, setTxFilter, reload,
    paidDebitIds, transactions, filteredTransactions,
  };
}
