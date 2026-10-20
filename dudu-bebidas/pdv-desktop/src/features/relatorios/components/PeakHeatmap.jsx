import { WEEKDAYS } from "../services/reportsInsights";
import { NoData } from "./ReportBits";

// Mapa dia da semana × hora — quanto mais escuro, mais vendas naquele horário.
export default function PeakHeatmap({ peak, unitLabel = "venda" }) {
  if (!peak || peak.max === 0) return <NoData />;

  return (
    <>
      <p className="rpt-section-hint">
        Pico: <strong>{WEEKDAYS[peak.best.day]} às {peak.best.hour}h</strong> · dia mais forte:{" "}
        <strong>{WEEKDAYS[peak.bestDay.day]}</strong> ({peak.bestDay.count} {unitLabel}s)
      </p>
      <div className="rpt-heatmap-wrap">
        <table className="rpt-heatmap">
          <thead>
            <tr>
              <th />
              {peak.hours.map((h) => (
                <th key={h}>{h}h</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {peak.grid.map((hours, day) => (
              <tr key={day}>
                <th>{WEEKDAYS[day]}</th>
                {peak.hours.map((h) => {
                  const cell = hours[h];
                  const intensity = cell.count / peak.max;
                  return (
                    <td
                      key={h}
                      title={`${WEEKDAYS[day]} ${h}h — ${cell.count} ${unitLabel}(s)`}
                      style={cell.count ? { background: `rgba(255, 208, 0, ${0.15 + intensity * 0.85})` } : undefined}
                      className={cell.count ? "rpt-heat-cell" : "rpt-heat-cell rpt-heat-empty"}
                    >
                      {cell.count || ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
