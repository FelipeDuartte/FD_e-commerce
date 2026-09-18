import { formatBRL } from "../../../shared/utils/adminFormat";
import RevenueChart from "./RevenueChart";
import "./AdminReports.css";

// ── Period selector ───────────────────────────────────────────────────────────

const PERIODS = [
  { value: 1, label: "1 mês" },
  { value: 3, label: "3 meses" },
  { value: 6, label: "6 meses" },
  { value: 12, label: "12 meses" },
];

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

/** Retorna a medalha para as 3 primeiras posições, ou a posição numérica (1-based) depois disso. */
function rankMedal(index) {
  return RANK_MEDALS[index] ?? index + 1;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminReports({
  reportData,
  loading,
  error,
  period,
  setPeriod,
  refresh,
}) {
  if (loading) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        <p>Carregando relatórios...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rpt-error">
        <p>⚠️ {error}</p>
        <button className="rpt-retry-btn" onClick={refresh}>
          Tentar novamente
        </button>
      </div>
    );
  }

  const { summary, monthly, topProducts, topCustomers } = reportData ?? {};

  const topProduct = topProducts?.[0];

  const summaryCards = [
    {
      icon: "💰",
      value: formatBRL(summary?.totalRevenue ?? 0),
      label: "Faturamento total",
    },
    {
      icon: "📦",
      value: summary?.totalOrders ?? 0,
      label: "Total de pedidos",
    },
    {
      icon: "🧾",
      value: formatBRL(summary?.avgTicket ?? 0),
      label: "Ticket médio",
    },
    {
      icon: "🏆",
      value: topProduct?.name ?? "—",
      label: "Produto mais vendido",
      small: topProduct ? `${topProduct.quantity} unidades` : null,
    },
  ];

  return (
    <div className="rpt-root">
      {/* ── Header ── */}
      <div className="adm-title-row">
        <div>
          <h1 className="adm-title">Relatórios</h1>
          <p className="adm-subtitle">
            Visão consolidada do negócio · só conta pedidos já entregues/recebidos
          </p>
        </div>
        <div className="rpt-header-actions">
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
          <button
            className="rpt-refresh-btn"
            onClick={refresh}
            title="Atualizar dados"
            aria-label="Atualizar relatórios"
          >
            ↻ Atualizar
          </button>
        </div>
      </div>

      {/* ── Summary cards ── */}
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
      </div>

      {/* ── Revenue chart ── */}
      <div className="rpt-section">
        <h2 className="rpt-section-title">📈 Faturamento mensal</h2>
        {monthly?.every((m) => m.revenue === 0) ? (
          <p className="rpt-no-data">Nenhuma venda no período selecionado.</p>
        ) : (
          <div className="rpt-chart-wrap">
            <RevenueChart monthly={monthly} />
            {/* Totals below chart */}
            <div className="rpt-chart-legend">
              {monthly?.map((m) => (
                <div key={m.key} className="rpt-chart-legend-item">
                  <span className="rpt-chart-legend-month">{m.label}</span>
                  <span className="rpt-chart-legend-val">
                    {formatBRL(m.revenue)}
                  </span>
                  <span className="rpt-chart-legend-count">
                    {m.count} pedido{m.count !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Two-column section ── */}
      <div className="rpt-two-col">
        {/* Top products */}
        <div className="rpt-section">
          <h2 className="rpt-section-title">🏅 Produtos mais vendidos</h2>
          {!topProducts?.length ? (
            <p className="rpt-no-data">Sem dados no período.</p>
          ) : (
            <table className="rpt-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Produto</th>
                  <th>Qtd.</th>
                  <th>Faturado</th>
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

        {/* Top customers */}
        <div className="rpt-section">
          <h2 className="rpt-section-title">👑 Clientes que mais compram</h2>
          {!topCustomers?.length ? (
            <p className="rpt-no-data">Sem dados no período.</p>
          ) : (
            <table className="rpt-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Cliente</th>
                  <th>Pedidos</th>
                  <th>Total gasto</th>
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
      </div>
    </div>
  );
}
