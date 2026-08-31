import { useEffect, useState } from "react";
import { formatBRL } from "../utils/format";
import { PAYMENT_METHODS } from "../constants";
import { listRecentSales, listCancelledSales, listFullHistorySales } from "../services/pdvService";

const FILTERS = [
  { key: "atual", label: "Caixa atual" },
  { key: "recentes", label: "Recentes (7 dias)" },
  { key: "canceladas", label: "Canceladas (30 dias)" },
  { key: "completo", label: "Completo (últimas 150)" },
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

  return (
    <div className="pdv-session-sales">
      <h2 className="adm-store-section-title">Histórico de vendas</h2>

      <div className="pdv-clientes-filters">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`pdv-clientes-filter-btn ${filter === f.key ? "active" : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {sales.length > 0 && (
        <div className="pdv-history-summary">
          <div className="pdv-history-summary-row">
            <span>{summary.activeCount} venda(s){summary.cancelledCount > 0 ? ` · ${summary.cancelledCount} cancelada(s)` : ""}</span>
            <strong>{formatBRL(summary.total)}</strong>
          </div>
          {Object.keys(summary.byMethod).length > 0 && (
            <div className="pdv-history-summary-methods">
              {Object.entries(summary.byMethod).map(([method, amount]) => (
                <span key={method} className="pdv-history-summary-method">
                  {methodLabel(method)}: {formatBRL(amount)}
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
                <span className="pdv-sale-time" title={new Date(sale.createdAt).toLocaleString("pt-BR")}>
                  {new Date(sale.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}{" "}
                  {new Date(sale.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="pdv-sale-items" title={sale.itemsLabel}>
                  {sale.itemsLabel || `${sale.itemCount} item(ns)`}
                </span>
                <span>{methodLabel(sale.paymentMethod)}</span>
                <strong>{formatBRL(sale.total)}</strong>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
