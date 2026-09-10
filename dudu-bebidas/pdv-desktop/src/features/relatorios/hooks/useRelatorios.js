import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchOrdersForReports,
  fetchOrderItemsForReports,
  fetchOrderPaymentsForReports,
} from "../services/reportsFetch";
import {
  aggregateMonthly,
  aggregateTopCustomers,
  aggregateTopProducts,
  aggregatePaymentBreakdown,
  aggregateChannelSplit,
  filterByPeriod,
  summariseOrders,
} from "../services/reportsAggregate";

const STALE_MS = 5 * 60 * 1000; // 5 minutos de cache

/**
 * Relatório do PDV — dois recortes independentes ("balcao" só venda de
 * balcão, "geral" site + balcão) com cache próprio cada um, já que são
 * buscas diferentes no banco (não dá pra re-filtrar client-side igual o
 * período). Trocar de período só reagrega o que já foi buscado.
 */
export function useRelatorios() {
  const [channel, setChannel] = useState("balcao"); // "balcao" | "geral"
  const [period, setPeriod] = useState({ unit: "months", amount: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reportData, setReportData] = useState(null);

  const cache = useRef({ balcao: null, geral: null });

  const aggregate = useCallback((raw, months) => {
    const orders = filterByPeriod(raw.orders, months);
    const orderIds = new Set(orders.map((o) => o.id));
    const items = raw.items.filter((i) => orderIds.has(i.order_id));
    const payments = raw.payments.filter((p) => orderIds.has(p.order_id));

    return {
      summary: summariseOrders(orders),
      monthly: aggregateMonthly(orders),
      topProducts: aggregateTopProducts(items),
      topCustomers: aggregateTopCustomers(orders),
      paymentBreakdown: aggregatePaymentBreakdown(orders, payments),
      channelSplit: aggregateChannelSplit(orders),
    };
  }, []);

  const load = useCallback(
    async (force = false) => {
      const entry = cache.current[channel];
      const now = Date.now();
      const isStale = !entry || now - entry.fetchedAt > STALE_MS;

      if (!force && !isStale) {
        setReportData(aggregate(entry, period));
        return;
      }

      setLoading(true);
      setError("");

      try {
        const orders = await fetchOrdersForReports(
          channel === "balcao" ? { channel: "balcao" } : {},
        );
        const orderIds = orders.map((o) => o.id);
        const mistoIds = orders
          .filter((o) => o.payment_method === "misto")
          .map((o) => o.id);
        const [items, payments] = await Promise.all([
          fetchOrderItemsForReports(orderIds),
          fetchOrderPaymentsForReports(mistoIds),
        ]);

        const raw = { orders, items, payments, fetchedAt: Date.now() };
        cache.current[channel] = raw;
        setReportData(aggregate(raw, period));
      } catch (err) {
        console.error(err);
        setError(err.message ?? "Erro ao carregar relatórios.");
      }
      setLoading(false);
    },
    [channel, period, aggregate],
  );

  // Busca sempre que o recorte (balcão/geral) muda — cache próprio por canal.
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  // Reagrega sem rede quando só o período muda, se já tem cache pro canal atual.
  useEffect(() => {
    const entry = cache.current[channel];
    if (entry) setReportData(aggregate(entry, period));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  return {
    reportData, loading, error,
    period, setPeriod,
    channel, setChannel,
    refresh: () => load(true),
  };
}
