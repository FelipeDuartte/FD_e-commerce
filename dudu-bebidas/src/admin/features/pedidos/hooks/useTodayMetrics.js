import { useCallback, useEffect, useReducer } from "react";
import { getTodayOrderMetrics } from "../services/adminOrderService";

const metricsReducer = (_, { count, total }) => ({ count, total });

// Fonte de dados independente da lista paginada — métricas do dia (contagem
// + total vendido), recarregadas no boot e a cada evento realtime relevante.
export function useTodayMetrics(isAdmin) {
  const [metrics, dispatchMetrics] = useReducer(metricsReducer, {
    count: 0,
    total: 0,
  });

  const fetchTodayMetrics = useCallback(async () => {
    try {
      dispatchMetrics(await getTodayOrderMetrics());
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetchTodayMetrics();
  }, [isAdmin, fetchTodayMetrics]);

  return { metrics, refetch: fetchTodayMetrics };
}
