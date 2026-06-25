import { useCallback, useEffect, useRef, useState } from "react";
import {
  aggregateMonthly,
  aggregateTopCustomers,
  aggregateTopProducts,
  fetchOrderItemsForReports,
  fetchOrdersForReports,
  filterByPeriod,
  summariseOrders,
} from "../services/adminReportService";

const STALE_MS = 5 * 60 * 1000; // 5 minutes cache

/**
 * Loads all data needed for the reports tab.
 *
 * Strategy:
 *  - Fetch ALL orders + items for the last 12 months once.
 *  - Cache the raw payload; re-aggregate client-side when `period` changes.
 *  - Refetch from Supabase only when the cache is stale (> 5 min) or `refresh` is called.
 */
export function useAdminReports(isActive) {
  const [period, setPeriod] = useState(3); // months: 1 | 3 | 6 | 12
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reportData, setReportData] = useState(null);

  // Raw 12-month data cached between period switches
  const cache = useRef({ orders: null, items: null, fetchedAt: null });

  const aggregate = useCallback((allOrders, allItems, months) => {
    const orders = filterByPeriod(allOrders, months);
    const orderIds = new Set(orders.map((o) => o.id));
    const items = allItems.filter((i) => orderIds.has(i.order_id));

    return {
      summary: summariseOrders(orders),
      monthly: aggregateMonthly(orders),
      topProducts: aggregateTopProducts(items),
      topCustomers: aggregateTopCustomers(orders),
    };
  }, []);

  const load = useCallback(
    async (force = false) => {
      const now = Date.now();
      const isStale =
        !cache.current.fetchedAt ||
        now - cache.current.fetchedAt > STALE_MS;

      if (!force && !isStale && cache.current.orders) {
        // Re-aggregate from cache without a network round-trip
        setReportData(
          aggregate(cache.current.orders, cache.current.items, period),
        );
        return;
      }

      setLoading(true);
      setError("");

      try {
        const orders = await fetchOrdersForReports();
        const orderIds = orders.map((o) => o.id);
        const items = await fetchOrderItemsForReports(orderIds);

        // Attach order_id to each item so `aggregate` can filter by period
        // NOTE: fetchOrderItemsForReports returns { name, quantity, price, order_id }
        //       We request `order_id` inside the service select – verify schema below.
        cache.current = { orders, items, fetchedAt: Date.now() };
        setReportData(aggregate(orders, items, period));
      } catch (err) {
        console.error(err);
        setError(err.message ?? "Erro ao carregar relatórios.");
      } finally {
        setLoading(false);
      }
    },
    [aggregate, period],
  );

  // Fetch when the tab becomes active for the first time
  useEffect(() => {
    if (isActive) load();
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-aggregate whenever period changes (no network call if cache is fresh)
  useEffect(() => {
    if (!isActive) return;
    if (cache.current.orders) {
      setReportData(
        aggregate(cache.current.orders, cache.current.items, period),
      );
    }
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    reportData,
    loading,
    error,
    period,
    setPeriod,
    refresh: () => load(true),
  };
}
