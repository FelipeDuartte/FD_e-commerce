import { formatBRL } from "../../../../shared/utils/format";
import { Section, SummaryGrid, NoData } from "../ReportBits";

const RANK_MEDALS = ["🥇", "🥈", "🥉"];
const rankMedal = (i) => RANK_MEDALS[i] ?? i + 1;

export default function CustomersTab({ data, fiado }) {
  const { topCustomers } = data;

  return (
    <>
      {fiado && (
        <SummaryGrid
          cards={[
            { icon: "📝", value: formatBRL(fiado.total), label: "Fiado em aberto (hoje)" },
            { icon: "👥", value: fiado.debtors, label: "Clientes devendo" },
          ]}
        />
      )}

      <Section
        title="👑 Clientes que mais compram"
        hint="Pedidos do site e vendas do balcão com nome/telefone informados."
      >
        {!topCustomers.length ? (
          <NoData />
        ) : (
          <table className="rpt-table">
            <thead>
              <tr><th>#</th><th>Cliente</th><th>Pedidos</th><th>Total gasto</th></tr>
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
      </Section>
    </>
  );
}
