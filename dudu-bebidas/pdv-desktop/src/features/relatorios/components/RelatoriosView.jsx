import { useEffect, useState } from "react";
import { formatBRL } from "../../../shared/utils/format";
import { useRelatorios } from "../hooks/useRelatorios";
import { listPdvCustomerBalances } from "../../clientes/services/fiadoService";
import RevenueChart from "./RevenueChart";
import PaymentBreakdownCard from "./PaymentBreakdownCard";

const PERIODS = [
  { value: 1, label: "1 mês" },
  { value: 3, label: "3 meses" },
  { value: 6, label: "6 meses" },
  { value: 12, label: "12 meses" },
];

const RANK_MEDALS = ["🥇", "🥈", "🥉"];
function rankMedal(index) {
  return RANK_MEDALS[index] ?? index + 1;
}

// Saldo de fiado em aberto (soma do que todo cliente deve agora) — é uma
// foto do momento, não do período selecionado, e só faz sentido no recorte
// Balcão (fiado é 100% exclusivo do balcão).
function useFiadoOutstanding(enabled) {
  const [total, setTotal] = useState(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    listPdvCustomerBalances()
      .then((customers) => {
        if (cancelled) return;
        const sum = customers.reduce((s, c) => (c.balance > 0 ? s + c.balance : s), 0);
        setTotal(sum);
      })
      .catch(() => {
        if (!cancelled) setTotal(null);
      });
    return () => { cancelled = true; };
  }, [enabled]);

  return total;
}

export default function RelatoriosView() {
  const { reportData, loading, error, period, setPeriod, channel, setChannel, refresh } = useRelatorios();
  const fiadoOutstanding = useFiadoOutstanding(channel === "balcao");

  const { summary, monthly, topProducts, topCustomers, paymentBreakdown, channelSplit } = reportData ?? {};
  const topProduct = topProducts?.[0];

  const summaryCards = [
    { icon: "💰", value: formatBRL(summary?.totalRevenue ?? 0), label: "Faturamento total" },
    { icon: "🧾", value: summary?.totalOrders ?? 0, label: channel === "balcao" ? "Total de vendas" : "Total de pedidos" },
    { icon: "🎯", value: formatBRL(summary?.avgTicket ?? 0), label: "Ticket médio" },
    {
      icon: "🏆",
      value: topProduct?.name ?? "—",
      label: "Produto mais vendido",
      small: topProduct ? `${topProduct.quantity} unidades` : null,
    },
  ];

  return (
    <div className="rpt-root">
      <div className="adm-title-row">
        <div>
          <h1 className="adm-title">Relatórios</h1>
          <p className="adm-subtitle">
            {channel === "balcao"
              ? "Só vendas feitas no balcão · não inclui pedidos rejeitados ou cancelados"
              : "Site + balcão juntos · não inclui pedidos rejeitados ou cancelados"}
          </p>
        </div>
        <div className="rpt-header-actions">
          <button className="rpt-refresh-btn" onClick={refresh} title="Atualizar dados">
            ↻ Atualizar
          </button>
        </div>
      </div>

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
            key={p.value}
            className={`rpt-period-btn ${period === p.value ? "rpt-period-btn-active" : ""}`}
            onClick={() => setPeriod(p.value)}
            aria-pressed={period === p.value}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rpt-error">
          <p>⚠️ {error}</p>
          <button className="rpt-retry-btn" onClick={refresh}>Tentar novamente</button>
        </div>
      )}

      {loading || !reportData ? (
        <div className="adm-loading"><div className="adm-spinner" /><p>Carregando relatórios...</p></div>
      ) : (
        <>
          <div className="rpt-summary-grid">
            {summaryCards.map(({ icon, value, label, small }) => (
              <div key={label} className="rpt-summary-card">
                <span className="rpt-summary-icon">{icon}</span>
                <div className="rpt-summary-content">
                  <span className="rpt-summary-value">{value}</span>
                  <span className="rpt-summary-label">{label}</span>
                  {small && <span className="rpt-summary-small">{small}</span>}
                </div>
              </div>
            ))}

            {channel === "balcao" && fiadoOutstanding != null && (
              <div className="rpt-summary-card">
                <span className="rpt-summary-icon">📝</span>
                <div className="rpt-summary-content">
                  <span className="rpt-summary-value">{formatBRL(fiadoOutstanding)}</span>
                  <span className="rpt-summary-label">Em aberto (hoje)</span>
                </div>
              </div>
            )}

            {channel === "geral" && channelSplit && (
              <div className="rpt-summary-card">
                <span className="rpt-summary-icon">🧮</span>
                <div className="rpt-summary-content">
                  <span className="rpt-summary-value">{formatBRL(channelSplit.balcao)}</span>
                  <span className="rpt-summary-label">Balcão · site {formatBRL(channelSplit.online)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="rpt-section">
            <h2 className="rpt-section-title">📈 Faturamento mensal</h2>
            {monthly?.every((m) => m.revenue === 0) ? (
              <p className="rpt-no-data">Nenhuma venda no período selecionado.</p>
            ) : (
              <div className="rpt-chart-wrap">
                <RevenueChart monthly={monthly} />
                <div className="rpt-chart-legend">
                  {monthly?.map((m) => (
                    <div key={m.key} className="rpt-chart-legend-item">
                      <span className="rpt-chart-legend-month">{m.label}</span>
                      <span className="rpt-chart-legend-val">{formatBRL(m.revenue)}</span>
                      <span className="rpt-chart-legend-count">
                        {m.count} venda{m.count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rpt-two-col">
            <div className="rpt-section">
              <h2 className="rpt-section-title">💳 Faturamento por forma de pagamento</h2>
              <PaymentBreakdownCard breakdown={paymentBreakdown} />
            </div>

            <div className="rpt-section">
              <h2 className="rpt-section-title">🏅 Produtos mais vendidos</h2>
              {!topProducts?.length ? (
                <p className="rpt-no-data">Sem dados no período.</p>
              ) : (
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Produto</th><th>Qtd.</th><th>Faturado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p, i) => (
                      <tr key={p.name}>
                        <td className="rpt-rank">{rankMedal(i)}</td>
                        <td className="rpt-product-name">{p.name}</td>
                        <td className="rpt-qty">{p.quantity}</td>
                        <td className="rpt-revenue">{formatBRL(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {channel === "geral" && (
            <div className="rpt-section">
              <h2 className="rpt-section-title">👑 Clientes que mais compram</h2>
              {!topCustomers?.length ? (
                <p className="rpt-no-data">Sem dados no período.</p>
              ) : (
                <table className="rpt-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Cliente</th><th>Pedidos</th><th>Total gasto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCustomers.map((c, i) => (
                      <tr key={c.displayName}>
                        <td className="rpt-rank">{rankMedal(i)}</td>
                        <td className="rpt-customer-name">{c.displayName}</td>
                        <td className="rpt-qty">{c.count}</td>
                        <td className="rpt-revenue">{formatBRL(c.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
