import { useEffect, useState } from "react";
import { useRelatorios } from "../hooks/useRelatorios";
import { listPdvCustomerBalances } from "../../clientes/services/fiadoService";
import OverviewTab from "./tabs/OverviewTab";
import ProductsTab from "./tabs/ProductsTab";
import MarginsTab from "./tabs/MarginsTab";
import StockTab from "./tabs/StockTab";
import DeliveryTab from "./tabs/DeliveryTab";
import CustomersTab from "./tabs/CustomersTab";

const PERIODS = [
  { key: "7d", label: "Última semana", value: { unit: "days", amount: 7 } },
  { key: "1m", label: "1 mês", value: { unit: "months", amount: 1 } },
  { key: "3m", label: "3 meses", value: { unit: "months", amount: 3 } },
  { key: "6m", label: "6 meses", value: { unit: "months", amount: 6 } },
  { key: "12m", label: "12 meses", value: { unit: "months", amount: 12 } },
];

const TABS = [
  { key: "geral", label: "📊 Visão geral" },
  { key: "produtos", label: "🏅 Produtos" },
  { key: "margens", label: "💹 Margens e resultado" },
  { key: "estoque", label: "📦 Estoque" },
  { key: "delivery", label: "🛵 Delivery" },
  { key: "clientes", label: "👑 Clientes" },
];

const TAB_STORAGE_KEY = "pdv-relatorios-tab";

const isSamePeriod = (a, b) => a?.unit === b?.unit && a?.amount === b?.amount;

function readSavedTab() {
  try {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    return TABS.some((t) => t.key === saved) ? saved : "geral";
  } catch {
    return "geral";
  }
}

// Fiado em aberto é uma foto de agora (não do período) — soma o que todo
// cliente deve e quantos estão devendo.
function useFiadoOutstanding() {
  const [fiado, setFiado] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listPdvCustomerBalances()
      .then((customers) => {
        if (cancelled) return;
        const debtors = customers.filter((c) => c.balance > 0.004);
        setFiado({ total: debtors.reduce((s, c) => s + c.balance, 0), debtors: debtors.length });
      })
      .catch(() => {
        if (!cancelled) setFiado(null);
      });
    return () => { cancelled = true; };
  }, []);

  return fiado;
}

export default function RelatoriosView() {
  const { reportData, products, allLines, loading, error, period, setPeriod, channel, setChannel, refresh } = useRelatorios();
  const fiado = useFiadoOutstanding();
  const [tab, setTabRaw] = useState(readSavedTab);

  const setTab = (key) => {
    setTabRaw(key);
    try {
      localStorage.setItem(TAB_STORAGE_KEY, key);
    } catch {
      // sem localStorage (modo privado): só não lembra a aba
    }
  };

  const usesFilters = tab !== "estoque";

  return (
    <div className="rpt-root">
      <div className="adm-title-row">
        <div>
          <h1 className="adm-title">Relatórios</h1>
          <p className="adm-subtitle">
            {channel === "balcao" ? "Só vendas do balcão" : "Site + balcão juntos"} · só pedidos já concluídos
          </p>
        </div>
        <div className="rpt-header-actions">
          <button className="rpt-refresh-btn" onClick={refresh} title="Atualizar dados">
            ↻ Atualizar
          </button>
        </div>
      </div>

      <nav className="rpt-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`rpt-tab ${tab === t.key ? "active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {usesFilters && (
        <div className="rpt-filters">
          <div className="pdv-clientes-filters">
            <button
              className={`pdv-clientes-filter-btn ${channel === "balcao" ? "active" : ""}`}
              onClick={() => setChannel("balcao")}
            >
              🧾 Balcão
            </button>
            <button
              className={`pdv-clientes-filter-btn ${channel === "geral" ? "active" : ""}`}
              onClick={() => setChannel("geral")}
            >
              🌐 Site + Balcão
            </button>
          </div>

          <div className="rpt-period-selector" role="group" aria-label="Período">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                className={`rpt-period-btn ${isSamePeriod(period, p.value) ? "rpt-period-btn-active" : ""}`}
                onClick={() => setPeriod(p.value)}
                aria-pressed={isSamePeriod(period, p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rpt-error">
          <p>⚠️ {error}</p>
          <button className="rpt-retry-btn" onClick={refresh}>Tentar novamente</button>
        </div>
      )}

      {loading || !reportData ? (
        !error && <div className="adm-loading"><div className="adm-spinner" /><p>Carregando relatórios...</p></div>
      ) : (
        <div role="tabpanel">
          {tab === "geral" && <OverviewTab data={reportData} channel={channel} />}
          {tab === "produtos" && <ProductsTab data={reportData} />}
          {tab === "margens" && <MarginsTab data={reportData} />}
          {tab === "estoque" && <StockTab allLines={allLines} products={products} />}
          {tab === "delivery" && <DeliveryTab data={reportData} channel={channel} />}
          {tab === "clientes" && <CustomersTab data={reportData} fiado={fiado} />}
        </div>
      )}
    </div>
  );
}
