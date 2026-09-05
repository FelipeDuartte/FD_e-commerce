import { useCallback, useEffect, useState } from "react";
import { shouldRemoveOrder, isPhantomMercadoPagoOrder } from "../orderStatus";
import { listAdminOrders } from "../services/adminOrderService";

// Fetch paginado + filtro por status + a expiração automática (24h+) que
// já acontece tanto no fetch quanto num intervalo de 1min em memória.
// Expõe updateOrderLocally/updateOrderStatusLocally pra quem precisa
// patchear um pedido sem refetch (realtime, ações de mutação).
export function useOrdersList(isAdmin) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [ordersError, setOrdersError] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

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
  }, [isAdmin, fetchOrders]);

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
    orders, setOrders, loading, loadingMore, hasMore, page, totalCount, ordersError, setOrdersError,
    filterStatus, setFilterStatus, expandedId, setExpandedId, counts,
    fetchOrders, updateOrderLocally, updateOrderStatusLocally, handleLoadMore,
  };
}
