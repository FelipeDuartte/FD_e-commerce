import { useEffect, useState } from "react";
import { SalesSummary, SalesRows, summarize } from "./SalesParts";
import { listRecentSales, listCancelledSales, listFullHistorySales } from "../../../shared/services/salesService";
import SaleReceipt from "./SaleReceipt";
import PastCashSessions from "./PastCashSessions";

const FILTERS = [
  { key: "atual", label: "Caixa atual", hint: "Vendas da sessão de caixa aberta agora" },
  { key: "anteriores", label: "Caixas anteriores", hint: "Qualquer caixa já fechado — vendas, resumo e fechamento do dia" },
  { key: "recentes", label: "Recentes", hint: "Últimos 7 dias, todas as sessões" },
  { key: "canceladas", label: "Canceladas", hint: "Vendas canceladas nos últimos 30 dias" },
  { key: "completo", label: "Completo", hint: "Histórico geral — últimas 150 vendas" },
];

export default function HistorySalesList({
  currentSessionId, sessionSales, sessionFiadoPayments = [], cancelError, cancellingId, onCancelSale,
}) {
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
    if (filter === "atual" || filter === "anteriores") return;
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
  const summary = summarize(sales, filter === "atual" ? sessionFiadoPayments : []);
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

      {filter === "anteriores" ? (
        <PastCashSessions onPrint={handlePrint} />
      ) : (
        <>
          {(sales.length > 0 || (filter === "atual" && sessionFiadoPayments.length > 0)) && (
            <SalesSummary summary={summary} />
          )}

          {error && <div className="adm-modal-error">⚠️ {error}</div>}

          {loading ? (
            <div className="adm-loading"><div className="adm-spinner" /><p>Carregando...</p></div>
          ) : sales.length === 0 ? (
            <div className="adm-empty"><p>Nenhuma venda encontrada.</p></div>
          ) : (
            <SalesRows
              sales={sales}
              canCancel={(sale) => sale.cashSessionId === currentSessionId}
              cancellingId={cancellingId}
              onCancelSale={onCancelSale}
              onPrint={handlePrint}
            />
          )}
        </>
      )}

      <SaleReceipt sale={printingSale} />
    </div>
  );
}
