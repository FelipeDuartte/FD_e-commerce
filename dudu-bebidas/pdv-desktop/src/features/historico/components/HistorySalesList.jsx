import { useEffect, useState } from "react";
import { formatBRL } from "../../../shared/utils/format";
import { PAYMENT_METHODS } from "../../../shared/constants";
import { listRecentSales, listCancelledSales, listFullHistorySales } from "../../../shared/services/salesService";
import SaleReceipt from "./SaleReceipt";

const FILTERS = [
  { key: "atual", label: "Caixa atual", hint: "Vendas da sessão de caixa aberta agora" },
  { key: "recentes", label: "Recentes", hint: "Últimos 7 dias, todas as sessões" },
  { key: "canceladas", label: "Canceladas", hint: "Vendas canceladas nos últimos 30 dias" },
  { key: "completo", label: "Completo", hint: "Histórico geral — últimas 150 vendas" },
];

function methodLabel(method) {
  const known = PAYMENT_METHODS.find((m) => m.value === method);
  return known ? `${known.icon} ${known.label}` : method;
}

function summarize(sales) {
  const active = sales.filter((s) => !s.cancelled);
  const cancelledCount = sales.length - active.length;
  const total = active.reduce((sum, s) => sum + s.total, 0);
  const byMethod = {};
  for (const s of active) {
    byMethod[s.paymentMethod] = (byMethod[s.paymentMethod] ?? 0) + s.total;
  }
  return { activeCount: active.length, cancelledCount, total, byMethod };
}

export default function HistorySalesList({ currentSessionId, sessionSales, cancelError, cancellingId, onCancelSale }) {
  const [filter, setFilter] = useState("atual");
  const [otherSales, setOtherSales] = useState([]);
  const [otherLoading, setOtherLoading] = useState(false);
  const [otherError, setOtherError] = useState("");
  const [printingSale, setPrintingSale] = useState(null);

  const handlePrint = (sale) => {
    setPrintingSale(sale);
    setTimeout(() => window.print(), 60);
  };

  useEffect(() => {
    if (filter === "atual") return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setOtherLoading(true);
      setOtherError("");
      try {
        const loader = { recentes: listRecentSales, canceladas: listCancelledSales, completo: listFullHistorySales }[filter];
        const data = await loader();
        if (!cancelled) setOtherSales(data);
      } catch (e) {
        if (!cancelled) setOtherError(e.message);
      }
      if (!cancelled) setOtherLoading(false);
      // sessionSales muda de referência a cada venda/cancelamento — usado
      // aqui só como gatilho pra recarregar as outras abas junto.
    }, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [filter, sessionSales]);

  const sales = filter === "atual" ? sessionSales : otherSales;
  const loading = filter !== "atual" && otherLoading;
  const error = filter === "atual" ? cancelError : otherError;
  const summary = summarize(sales);
  const activeFilter = FILTERS.find((f) => f.key === filter);

  return (
    <div className="pdv-history">
      <div>
        <h2 className="adm-store-section-title">Histórico de vendas</h2>
        <p className="adm-store-section-desc">{activeFilter.hint}</p>
      </div>

      <div className="pdv-clientes-filters">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`pdv-clientes-filter-btn ${filter === f.key ? "active" : ""}`}
            title={f.hint}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {sales.length > 0 && (
        <div className="pdv-history-summary">
          <div className="pdv-history-summary-main">
            <span className="pdv-history-summary-count">
              {summary.activeCount} venda(s)
              {summary.cancelledCount > 0 && (
                <span className="pdv-history-summary-cancelled"> · {summary.cancelledCount} cancelada(s)</span>
              )}
            </span>
            <strong className="pdv-history-summary-total">{formatBRL(summary.total)}</strong>
          </div>
          {Object.keys(summary.byMethod).length > 0 && (
            <div className="pdv-history-summary-methods">
              {Object.entries(summary.byMethod).map(([method, amount]) => (
                <span key={method} className="pdv-history-summary-method">
                  <span>{methodLabel(method)}</span>
                  <strong>{formatBRL(amount)}</strong>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <div className="adm-modal-error">⚠️ {error}</div>}

      {loading ? (
        <div className="adm-loading"><div className="adm-spinner" /><p>Carregando...</p></div>
      ) : sales.length === 0 ? (
        <div className="adm-empty"><p>Nenhuma venda encontrada.</p></div>
      ) : (
        <div className="pdv-sales-list">
          {sales.map((sale) => {
            const canCancel = !sale.cancelled && sale.cashSessionId === currentSessionId;
            return (
              <div
                key={sale.orderId}
                className={`pdv-sale-row ${sale.cancelled ? "pdv-sale-cancelled" : ""}`}
              >
                <div className="pdv-sale-id-col">
                  {sale.orderNumber != null && <strong className="pdv-sale-number">#{sale.orderNumber}</strong>}
                  <span className="pdv-sale-time" title={new Date(sale.createdAt).toLocaleString("pt-BR")}>
                    {new Date(sale.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}{" "}
                    {new Date(sale.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <span className="pdv-sale-items" title={sale.itemsLabel}>
                  {sale.itemsLabel || `${sale.itemCount} item(ns)`}
                </span>
                <span>{methodLabel(sale.paymentMethod)}</span>
                <strong>{formatBRL(sale.total)}</strong>
                <div className="pdv-sale-actions">
                  <button
                    type="button"
                    className="pdv-print-btn"
                    title="Imprimir notinha"
                    onClick={() => handlePrint(sale)}
                  >
                    🖨️
                  </button>
                  {sale.cancelled ? (
                    <span className="pdv-sale-cancelled-label">Cancelada</span>
                  ) : canCancel ? (
                    <button
                      className="adm-btn-delete"
                      onClick={() => onCancelSale(sale)}
                      disabled={cancellingId === sale.orderId}
                    >
                      {cancellingId === sale.orderId ? "..." : "🗑️ Cancelar"}
                    </button>
                  ) : (
                    <span className="pdv-sale-locked-label" title="Só é possível cancelar vendas do caixa aberto agora">
                      —
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SaleReceipt sale={printingSale} />
    </div>
  );
}
