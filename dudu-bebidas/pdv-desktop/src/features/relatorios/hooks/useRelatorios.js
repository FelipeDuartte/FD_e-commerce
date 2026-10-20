import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchSalesForReports,
  fetchFiadoReceiptsForReports,
  fetchLostOnlineOrdersForReports,
  fetchStockEntriesForReports,
  fetchPaidBillsForReports,
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
import {
  buildCostResolver,
  buildSaleLines,
  aggregateMargins,
  aggregateCashResult,
  aggregateByCategory,
  aggregateAbc,
  aggregatePackVsUnit,
  aggregateDelivery,
  aggregatePeakHours,
} from "../services/reportsInsights";
import { listAdminProducts } from "../../produtos/services/productService";

const STALE_MS = 5 * 60 * 1000; // 5 minutos de cache

// Fora do componente de propósito: sair da aba Relatórios desmonta a tela,
// e sem isso voltar nela baixava 12 meses de vendas de novo toda vez.
const cache = { raw: null, fetchedAt: 0 };

/**
 * Relatório do PDV. Busca tudo uma vez (site + balcão, 12 meses) e o
 * filtro de canal/período só reagrega na tela, sem ir ao banco de novo.
 *
 * Duas bases diferentes, de propósito:
 *   - faturamento (Visão geral, caixa): só dinheiro recebido — venda fiado
 *     entra quando o cliente paga (recebimento), não na hora da venda;
 *   - produtos (margem, ABC, categorias, estoque): toda mercadoria que
 *     saiu, inclusive fiado — o produto saiu da loja na hora.
 */
export function useRelatorios() {
  const [channel, setChannel] = useState("balcao"); // "balcao" | "geral"
  const [period, setPeriod] = useState({ unit: "months", amount: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [raw, setRaw] = useState(cache.raw);

  const load = useCallback(async (force = false) => {
    if (!force && cache.raw && Date.now() - cache.fetchedAt < STALE_MS) {
      setRaw(cache.raw);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [sales, receipts, lostOrders, stockEntries, bills, products] = await Promise.all([
        fetchSalesForReports(),
        fetchFiadoReceiptsForReports(),
        fetchLostOnlineOrdersForReports(),
        fetchStockEntriesForReports(),
        fetchPaidBillsForReports(),
        listAdminProducts(),
      ]);
      const next = { ...sales, receipts, lostOrders, stockEntries, bills, products };
      cache.raw = next;
      cache.fetchedAt = Date.now();
      setRaw(next);
    } catch (err) {
      console.error(err);
      setError(err.message ?? "Erro ao carregar relatórios.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Custo e linhas de venda dos 12 meses — independem do filtro, reusados
  // pela previsão de estoque (sempre últimos 30 dias, todos os canais).
  const base = useMemo(() => {
    if (!raw) return null;
    const costAt = buildCostResolver(raw.products, raw.stockEntries);
    return { costAt, allLines: buildSaleLines(raw.orders, raw.items, costAt) };
  }, [raw]);

  const reportData = useMemo(() => {
    if (!raw || !base) return null;
    const inChannel = (o) => channel === "geral" || o.channel === "balcao";

    const sales = filterByPeriod(raw.orders, period).filter(inChannel);
    const saleIds = new Set(sales.map((o) => o.id));
    const items = raw.items.filter((i) => saleIds.has(i.order_id));
    const payments = raw.payments.filter((p) => saleIds.has(p.order_id));
    const receipts = filterByPeriod(raw.receipts, period);
    const revenueRows = [...sales.filter((o) => o.payment_method !== "fiado"), ...receipts];
    const lines = base.allLines.filter((l) => saleIds.has(l.orderId));

    // Caixa usa a loja toda (as contas pagas não são separadas por canal).
    const allRevenueRows = [
      ...filterByPeriod(raw.orders, period).filter((o) => o.payment_method !== "fiado"),
      ...receipts,
    ];

    return {
      summary: summariseOrders(revenueRows),
      monthly: aggregateMonthly(revenueRows),
      paymentBreakdown: aggregatePaymentBreakdown(revenueRows, payments),
      channelSplit: aggregateChannelSplit(revenueRows),
      cardFees: sales.reduce((s, o) => s + Number(o.card_fee_amount ?? 0), 0),
      discounts: sales.reduce((s, o) => s + Number(o.discount_amount ?? 0), 0),
      peak: aggregatePeakHours(sales),
      topProducts: aggregateTopProducts(items),
      byCategory: aggregateByCategory(lines, raw.products),
      abc: aggregateAbc(lines, raw.products),
      packVsUnit: aggregatePackVsUnit(lines, raw.products),
      margins: aggregateMargins(lines, raw.products),
      cash: aggregateCashResult(allRevenueRows, raw.bills, raw.stockEntries, period),
      delivery: aggregateDelivery(sales, items, filterByPeriod(raw.lostOrders, period)),
      topCustomers: aggregateTopCustomers(sales.filter((o) => o.payment_method !== "fiado")),
    };
  }, [raw, base, channel, period]);

  return {
    reportData,
    products: raw?.products ?? [],
    allLines: base?.allLines ?? [],
    loading, error,
    period, setPeriod,
    channel, setChannel,
    refresh: () => load(true),
  };
}
