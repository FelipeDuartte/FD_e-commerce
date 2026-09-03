import { formatBRL } from "../../../shared/utils/adminFormat";

export default function RevenueChart({ monthly }) {
  if (!monthly?.length) return null;

  const W = 700;
  const H = 160;
  const PAD = { top: 12, right: 16, bottom: 32, left: 56 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const maxRev = Math.max(...monthly.map((m) => m.revenue), 1);
  const barW = (chartW / monthly.length) * 0.55;
  const gap = chartW / monthly.length;

  // Y-axis ticks (4 levels)
  const ticks = [0.25, 0.5, 0.75, 1].map((f) => ({
    y: PAD.top + chartH * (1 - f),
    label: formatBRL(maxRev * f),
  }));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="rpt-chart-svg"
      aria-label="Gráfico de faturamento mensal"
      role="img"
    >
      {/* Grid lines */}
      {ticks.map((t) => (
        <g key={t.y}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={t.y}
            y2={t.y}
            className="rpt-chart-grid"
          />
          <text x={PAD.left - 6} y={t.y + 4} className="rpt-chart-tick-y">
            {t.label}
          </text>
        </g>
      ))}

      {/* Bars */}
      {monthly.map((m, i) => {
        const barH = (m.revenue / maxRev) * chartH;
        const x = PAD.left + i * gap + (gap - barW) / 2;
        const y = PAD.top + chartH - barH;

        return (
          <g key={m.key} className="rpt-bar-group">
            {/* Background bar */}
            <rect
              x={x}
              y={PAD.top}
              width={barW}
              height={chartH}
              className="rpt-bar-bg"
              rx={4}
            />
            {/* Value bar */}
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH || 2}
              className="rpt-bar"
              rx={4}
            />
            {/* X label */}
            <text
              x={x + barW / 2}
              y={H - PAD.bottom + 14}
              className="rpt-chart-tick-x"
            >
              {m.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
