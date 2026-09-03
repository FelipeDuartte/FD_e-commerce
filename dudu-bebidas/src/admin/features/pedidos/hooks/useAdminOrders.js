import { useCallback, useEffect, useReducer, useState } from "react";
import { supabase, getCurrentStoreId } from "../../../../shared/supabase/Supabaseclient";
import { playNotificationSound, shouldRemoveOrder, isPhantomMercadoPagoOrder, getNext } from "../../../shared/adminUtils";
import {
  getTodayOrderMetrics,
  listAdminOrders,
  rejectAdminOrder,
  updateAdminOrderStatus,
} from "../services/adminOrderService";
import { markOrderPaid } from "../../loja/pagamentos/services/paymentConfigService";

const metricsReducer = (_, { count, total }) => ({ count, total });

// Concentra todo o estado/lógica da aba "Pedidos" (fetch paginado, métricas
// do dia, realtime, ações de aceitar/rejeitar/avançar status/marcar pago).
export function useAdminOrders(isAdmin) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [ordersError, setOrdersError] = useState("");
  const [updating, setUpdating] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [metrics, dispatchMetrics] = useReducer(metricsReducer, {
    count: 0,
    total: 0,
  });
  const [rejectModal, setRejectModal] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState("");

  const fetchTodayMetrics = useCallback(async () => {
    try {
      dispatchMetrics(await getTodayOrderMetrics());
    } catch (error) {
      console.error(error);
    }
  }, []);

  const fetchOrders = useCallback(
    async (pageNum = 0, reset = false) => {
      pageNum === 0 ? setLoading(true) : setLoadingMore(true);
      setOrdersError("");
      try {
        const result = await listAdminOrders({
          page: pageNum,
          status: filterStatus,
        });
        // Filtra pedidos "velhos" (24h+, exceto pending) já aqui no fetch —
        // sem isso, eles apareciam por até 1 minuto (até o próximo tick do
        // intervalo) toda vez que a página era carregada/recarregada. Também
        // filtra pedidos de cartão online recusados/cancelados/expirados —
        // nunca foram vendas de verdade.
        const visibleOrders = result.orders.filter(
          (o) => !shouldRemoveOrder(o) && !isPhantomMercadoPagoOrder(o),
        );
        const removedNow = result.orders.length - visibleOrders.length;

        setOrders((prev) =>
          reset || pageNum === 0 ? visibleOrders : [...prev, ...visibleOrders],
        );
        setHasMore(result.hasMore);
        setTotalCount(Math.max(0, result.count - removedNow));
      } catch (error) {
        console.error(error);
        setOrdersError(error.message);
      }
      pageNum === 0 ? setLoading(false) : setLoadingMore(false);
    },
    [filterStatus],
  );

  useEffect(() => {
    if (!isAdmin) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOrders(0, true);
    fetchTodayMetrics();
  }, [isAdmin, fetchOrders, fetchTodayMetrics]);

  // Reset ao mudar filtro
  useEffect(() => {
    if (!isAdmin) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(0);
    setOrders([]);
    setHasMore(true);
    fetchOrders(0, true);
  }, [filterStatus]); // eslint-disable-line

  // Verificar e remover pedidos antigos entregues (a cada 1 minuto)
  useEffect(() => {
    if (!isAdmin) return;
    const interval = setInterval(() => {
      setOrders((prev) => {
        const updated = prev.filter((o) => !shouldRemoveOrder(o) && !isPhantomMercadoPagoOrder(o));
        const removed = prev.length - updated.length;
        if (removed > 0) {
          setTotalCount((count) => Math.max(0, count - removed));
        }
        return updated;
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  // patch é mesclado no pedido existente antes de reavaliar se ele deve
  // sumir da lista — precisa receber payment_status/payment_provider (não só
  // status) pra pegar o caso do cartão Mercado Pago que nasce como
  // "processando_pagamento" (ainda visível) e vira "pagamento_recusado"
  // pouco depois via UPDATE (webhook/confirmação síncrona).
  const updateOrderLocally = useCallback(
    (orderId, patch) =>
      setOrders((prev) => {
        const updated = prev.reduce((acc, o) => {
          if (o.id !== orderId) return [...acc, o];
          const nextOrder = { ...o, ...patch };
          return shouldRemoveOrder(nextOrder) || isPhantomMercadoPagoOrder(nextOrder)
            ? acc
            : [...acc, nextOrder];
        }, []);
        if (updated.length !== prev.length) {
          setTotalCount((count) => Math.max(0, count - 1));
        }
        return updated;
      }),
    [],
  );
  const updateOrderStatusLocally = useCallback(
    (orderId, newStatus) => updateOrderLocally(orderId, { status: newStatus }),
    [updateOrderLocally],
  );

  // Realtime: novos pedidos, exclusões e mudanças de status
  // MULTI-LOJA: filtro por store_id — sem isso, o admin de uma loja
  // receberia som/refetch também quando OUTRA loja tivesse um pedido novo.
  useEffect(() => {
    if (!isAdmin) return;
    const storeId = getCurrentStoreId();
    if (!storeId) return;

    const channel = supabase
      .channel(`admin-orders-${storeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
        (payload) => {
          // Cartão online recusado na hora (ex: teste com cartão "OTHE") não
          // é uma venda de verdade — não toca som nem gasta um refetch por
          // causa dele.
          if (isPhantomMercadoPagoOrder(payload.new)) return;
          playNotificationSound();
          fetchOrders(0, true);
          fetchTodayMetrics();
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
        () => {
          fetchOrders(0, true);
          fetchTodayMetrics();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
        (payload) => {
          // Reflete em tempo real qualquer mudança de status feita em outro
          // lugar — inclusive o cliente cancelando o próprio pedido
          // (Confirm.jsx), sem precisar dar refresh na página. Manda
          // payment_status/payment_provider junto (não só status) pra pegar
          // o cartão Mercado Pago que é recusado logo após ser criado.
          updateOrderLocally(payload.new.id, {
            status: payload.new.status,
            payment_status: payload.new.payment_status,
            payment_provider: payload.new.payment_provider,
          });
          fetchTodayMetrics();
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [isAdmin, updateOrderLocally]); // eslint-disable-line

  const advanceStatus = useCallback(
    async (order) => {
      const next = getNext(order);
      if (!next) return;
      setUpdating(order.id);
      setOrdersError("");
      try {
        await updateAdminOrderStatus(order.id, next);
        updateOrderStatusLocally(order.id, next);
      } catch (error) {
        console.error(error);
        setOrdersError(error.message);
      }
      setUpdating(null);
    },
    [updateOrderStatusLocally],
  );

  const setStatus = useCallback(
    async (orderId, newStatus) => {
      setUpdating(orderId);
      setOrdersError("");
      try {
        await updateAdminOrderStatus(orderId, newStatus);
        updateOrderStatusLocally(orderId, newStatus);
      } catch (error) {
        console.error(error);
        setOrdersError(error.message);
      }
      setUpdating(null);
    },
    [updateOrderStatusLocally],
  );

  // Pix Fase 1: só registro informativo — não mexe em estoque nem no status
  // de preparo/entrega, só marca payment_status como pago.
  const markPaid = useCallback(async (orderId) => {
    setUpdating(orderId);
    setOrdersError("");
    try {
      await markOrderPaid(orderId);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, payment_status: "pago" } : o)),
      );
    } catch (error) {
      console.error(error);
      setOrdersError(error.message);
    }
    setUpdating(null);
  }, []);

  const confirmReject = useCallback(async () => {
    if (!rejectModal) return;
    setRejecting(true);
    setRejectError("");

    try {
      await rejectAdminOrder(rejectModal.id);
    } catch (error) {
      console.error(error);
      setRejectError(error.message);
      setRejecting(false);
      return;
    }

    // rejectAdminOrder não apaga mais — só atualiza o status localmente
    // (updateOrderStatusLocally já cuida de sumir da tela só se passar 24h,
    // igual todo o resto).
    updateOrderStatusLocally(rejectModal.id, "rejected");
    setRejectModal(null);
    setRejecting(false);
  }, [rejectModal, updateOrderStatusLocally]);

  const closeRejectModal = useCallback(() => {
    if (!rejecting) {
      setRejectModal(null);
      setRejectError("");
    }
  }, [rejecting]);

  const handleLoadMore = useCallback(() => {
    const next = page + 1;
    setPage(next);
    fetchOrders(next);
  }, [page, fetchOrders]);

  const counts = orders.reduce(
    (acc, o) => {
      acc.all++;
      if (o.status in acc) acc[o.status]++;
      return acc;
    },
    { all: 0, pending: 0, preparing: 0, on_the_way: 0, delivered: 0, rejected: 0, cancelled: 0 },
  );

  return {
    orders, loading, loadingMore, hasMore, page, totalCount, ordersError, updating,
    filterStatus, setFilterStatus, expandedId, setExpandedId, metrics,
    rejectModal, setRejectModal, rejecting, rejectError,
    advanceStatus, setStatus, markPaid, confirmReject, closeRejectModal, handleLoadMore,
    counts,
  };
}
