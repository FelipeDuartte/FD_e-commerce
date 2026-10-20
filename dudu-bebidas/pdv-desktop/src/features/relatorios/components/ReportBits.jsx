// Peças pequenas reusadas pelas abas do relatório.

export const fmtPct = (v, digits = 0) => (v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(digits)}%`);
export const fmtNum = (v, digits = 1) => (v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: digits }));

export function SummaryGrid({ cards }) {
  return (
    <div className="rpt-summary-grid">
      {cards.filter(Boolean).map(({ icon, value, label, small, tone }) => (
        <div key={label} className={`rpt-summary-card ${tone ? `rpt-summary-${tone}` : ""}`}>
          <span className="rpt-summary-icon">{icon}</span>
          <div className="rpt-summary-content">
            <span className="rpt-summary-value">{value}</span>
            <span className="rpt-summary-label">{label}</span>
            {small && <span className="rpt-summary-small">{small}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Section({ title, hint, actions, children }) {
  return (
    <div className="rpt-section">
      <div className="rpt-section-head">
        <h2 className="rpt-section-title">{title}</h2>
        {actions}
      </div>
      {hint && <p className="rpt-section-hint">{hint}</p>}
      {children}
    </div>
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="rpt-segmented" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`rpt-segmented-btn ${value === o.value ? "active" : ""}`}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function NoData({ children = "Sem dados no período." }) {
  return <p className="rpt-no-data">{children}</p>;
}

export function MarginBadge({ pct }) {
  if (pct == null) return <span className="rpt-badge rpt-badge-muted">sem custo</span>;
  const tone = pct < 0 ? "bad" : pct < 20 ? "warn" : "good";
  return <span className={`rpt-badge rpt-badge-${tone}`}>{fmtPct(pct)}</span>;
}
