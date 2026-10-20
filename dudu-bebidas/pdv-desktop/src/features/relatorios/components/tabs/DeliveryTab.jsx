import { useMemo } from "react";
import { formatBRL } from "../../../../shared/utils/format";
import { aggregatePeakHours } from "../../services/reportsInsights";
import PeakHeatmap from "../PeakHeatmap";
import { Section, SummaryGrid, NoData, fmtPct, fmtNum } from "../ReportBits";

export default function DeliveryTab({ data, channel }) {
  const d = data.delivery;
  const peak = useMemo(() => aggregatePeakHours(d.orders), [d.orders]);

  if (d.count === 0 && d.pickups === 0 && d.lost.rejected + d.lost.cancelled === 0) {
    return <NoData>Nenhuma entrega no período.</NoData>;
  }

  return (
    <>
      <SummaryGrid
        cards={[
          { icon: "🛵", value: d.count, label: "Entregas", small: d.fromCounter ? `${d.fromCounter} lançadas no balcão` : null },
          { icon: "💰", value: formatBRL(d.revenue), label: "Faturado em entregas" },
          { icon: "🎯", value: formatBRL(d.avgTicket), label: "Ticket médio da entrega" },
          { icon: "🚚", value: formatBRL(d.fees), label: "Taxas de entrega", small: "calculadas pelo total do pedido" },
          channel === "geral" && { icon: "🏪", value: d.pickups, label: "Retiradas (site)" },
          d.dispatch && {
            icon: "⏱️",
            value: `${fmtNum(d.dispatch.median, 0)} min`,
            label: "Tempo até sair (mediana)",
            small: `${fmtPct(d.dispatch.under30Pct)} saíram em até 30 min`,
          },
        ]}
      />

      {channel === "geral" && d.lost.rejected + d.lost.cancelled > 0 && (
        <div className={`rpt-alert ${d.lost.ratePct >= 10 ? "rpt-alert-warn" : "rpt-alert-muted"}`}>
          <strong>
            ❌ {d.lost.rejected + d.lost.cancelled} pedido(s) do site perdidos · {fmtPct(d.lost.ratePct, 1)} dos pedidos
          </strong>
          <span>
            {d.lost.rejected} recusado(s) pela loja · {d.lost.cancelled} cancelado(s) · {formatBRL(d.lost.value)} que deixou de entrar
          </span>
        </div>
      )}

      <div className="rpt-two-col">
        <Section title="📍 Bairros" hint="Onde estão os pedidos — ajuda a revisar taxa de entrega e área atendida.">
          {!d.byDistrict.length ? (
            <NoData />
          ) : (
            <div className="rpt-table-scroll">
              <table className="rpt-table">
                <thead>
                  <tr><th>Bairro</th><th>Entregas</th><th>Faturado</th><th>Ticket</th><th>Taxas</th></tr>
                </thead>
                <tbody>
                  {d.byDistrict.map((r) => (
                    <tr key={r.district}>
                      <td className="rpt-product-name">{r.district}</td>
                      <td className="rpt-qty">{r.count}</td>
                      <td className="rpt-revenue">{formatBRL(r.revenue)}</td>
                      <td className="rpt-qty">{formatBRL(r.avgTicket)}</td>
                      <td className="rpt-qty">{formatBRL(r.fees)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="🧑‍✈️ Entregadores">
          {!d.byCourier.length ? (
            <NoData />
          ) : (
            <table className="rpt-table">
              <thead>
                <tr><th>Entregador</th><th>Entregas</th><th>Valor entregue</th></tr>
              </thead>
              <tbody>
                {d.byCourier.map((r) => (
                  <tr key={r.courier}>
                    <td className="rpt-customer-name">{r.courier}</td>
                    <td className="rpt-qty">{r.count}</td>
                    <td className="rpt-revenue">{formatBRL(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {d.dispatch && (
            <p className="rpt-section-hint rpt-section-foot">
              ⏱️ Do pedido até sair para entrega: média {fmtNum(d.dispatch.avg, 0)} min · mediana{" "}
              {fmtNum(d.dispatch.median, 0)} min ({d.dispatch.count} pedidos com saída registrada).
            </p>
          )}
        </Section>
      </div>

      <Section title="🕒 Horários de pico do delivery">
        <PeakHeatmap peak={peak} unitLabel="entrega" />
      </Section>
    </>
  );
}
