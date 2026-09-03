import { useCallback } from "react";
import { useOrdersList } from "./useOrdersList";
import { useTodayMetrics } from "./useTodayMetrics";
import { useOrdersRealtime } from "./useOrdersRealtime";
import { useOrderActions } from "./useOrderActions";

// Compõe fetch/paginação (useOrdersList), métricas do dia (useTodayMetrics),
// realtime (useOrdersRealtime) e ações de mutação (useOrderActions) na
// mesma API que Admin.jsx/OrdersTab.jsx/OrderCard.jsx já consomem.
export function useAdminOrders(isAdmin) {
  const {
    orders, setOrders, loading, loadingMore, hasMore, page, totalCount,
    ordersError, setOrdersError, filterStatus, setFilterStatus,
    expandedId, setExpandedId, counts,
    fetchOrders, updateOrderLocally, updateOrderStatusLocally, handleLoadMore,
  } = useOrdersList(isAdmin);
  const { metrics, refetch: refetchMetrics } = useTodayMetrics(isAdmin);

  const handleRefetch = useCallback(() => {
    fetchOrders(0, true);
    refetchMetrics();
  }, [fetchOrders, refetchMetrics]);

  const handleUpdateOrderLocally = useCallback(
    (orderId, patch) => {
      updateOrderLocally(orderId, patch);
      refetchMetrics();
    },
    [updateOrderLocally, refetchMetrics],
  );

  useOrdersRealtime(isAdmin, {
    onRefetch: handleRefetch,
    onUpdateOrderLocally: handleUpdateOrderLocally,
  });

  const {
    updating, rejectModal, setRejectModal, rejecting, rejectError,
    advanceStatus, setStatus, markPaid, confirmReject, closeRejectModal,
  } = useOrderActions({ setOrders, updateOrderStatusLocally, setOrdersError });

  return {
    orders, loading, loadingMore, hasMore, page, totalCount, ordersError, updating,
    filterStatus, setFilterStatus, expandedId, setExpandedId, metrics,
    rejectModal, setRejectModal, rejecting, rejectError,
    advanceStatus, setStatus, markPaid, confirmReject, closeRejectModal, handleLoadMore,
    counts,
  };
}
