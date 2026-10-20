import { formatBRL } from "../../../../shared/utils/format";
import RevenueChart from "../RevenueChart";
import PaymentBreakdownCard from "../PaymentBreakdownCard";
import PeakHeatmap from "../PeakHeatmap";
import { Section, SummaryGrid, NoData } from "../ReportBits";

export default function OverviewTab({ data, channel }) {
  const { summary, monthly, paymentBreakdown, channelSplit, cardFees, discounts, peak } = data;

  return (
    <>
      <SummaryGrid
        cards={[
          { icon: "💰", value: formatBRL(summary.totalRevenue), label: "Faturamento recebido" },
          { icon: "🧾", value: summary.totalOrders, label: channel === "balcao" ? "Vendas" : "Vendas e pedidos" },
          { icon: "🎯", value: formatBRL(summary.avgTicket), label: "Ticket médio" },
          channel === "geral" && {
            icon: "🧮",
            value: formatBRL(channelSplit.balcao),
            label: `Balcão · site ${formatBRL(channelSplit.online)}`,
          },
          { icon: "🏷️", value: formatBRL(discounts), label: "Descontos dados" },
          { icon: "💳", value: formatBRL(cardFees), label: "Taxa da maquininha", small: "cobrada do cliente no crédito" },
        ]}
      />

      <Section title="📈 Faturamento mensal">
        {monthly.every((m) => m.revenue === 0) ? (
          <NoData>Nenhuma venda no período selecionado.</NoData>
        ) : (
          <div className="rpt-chart-wrap">
            <RevenueChart monthly={monthly} />
            <div className="rpt-chart-legend">
              {monthly.map((m) => (
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
      </Section>

      <div className="rpt-two-col">
        <Section title="💳 Faturamento por forma de pagamento">
          <PaymentBreakdownCard breakdown={paymentBreakdown} />
        </Section>
        <Section
          title="🕒 Horários de pico"
          hint="Quanto mais forte a cor, mais vendas naquele dia e horário — ajuda a montar a escala e saber quando gelar mais."
        >
          <PeakHeatmap peak={peak} />
        </Section>
      </div>
    </>
  );
}
