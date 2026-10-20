import { useMemo, useState } from "react";
import { formatBRL } from "../../../../shared/utils/format";
import { forecastStock, findIdleProducts, FORECAST_WINDOW_DAYS } from "../../services/reportsInsights";
import { Section, NoData, Segmented, fmtNum } from "../ReportBits";

const COVER_OPTIONS = [
  { value: 7, label: "1 semana" },
  { value: 14, label: "2 semanas" },
  { value: 30, label: "1 mês" },
];
const IDLE_OPTIONS = [
  { value: 30, label: "30 dias" },
  { value: 60, label: "60 dias" },
  { value: 90, label: "90 dias" },
];
const STATUS = {
  acabou: { label: "Acabou", tone: "bad" },
  critico: { label: "Até 3 dias", tone: "bad" },
  atencao: { label: "Até 7 dias", tone: "warn" },
  ok: { label: "Ok", tone: "good" },
};

function formatDays(days) {
  if (!Number.isFinite(days)) return "—";
  if (days < 1) return "hoje";
  return `${fmtNum(days, 0)} dia(s)`;
}

// Estoque é uma foto de agora e a média de venda usa sempre os últimos 30
// dias de todos os canais — por isso essa aba ignora os filtros do topo.
export default function StockTab({ allLines, products }) {
  const [coverDays, setCoverDays] = useState(14);
  const [idleDays, setIdleDays] = useState(30);
  const [onlyAttention, setOnlyAttention] = useState(true);

  const forecast = useMemo(() => forecastStock(allLines, products, coverDays), [allLines, products, coverDays]);
  const idle = useMemo(() => findIdleProducts(allLines, products, idleDays), [allLines, products, idleDays]);

  const visible = onlyAttention ? forecast.filter((f) => f.status !== "ok") : forecast;
  const idleCapital = idle.reduce((s, p) => s + (p.capital ?? 0), 0);

  return (
    <>
      <p className="rpt-tab-note">
        📌 Essa aba usa o estoque de agora e a média de vendas dos últimos {FORECAST_WINDOW_DAYS} dias (site + balcão) —
        não muda com os filtros do topo.
      </p>

      <Section
        title="⏳ Previsão de falta e sugestão de compra"
        hint="Em quantos dias cada produto acaba no ritmo atual e quanto comprar pra ficar coberto pelo período escolhido."
        actions={<Segmented options={COVER_OPTIONS} value={coverDays} onChange={setCoverDays} />}
      >
        <label className="rpt-check">
          <input type="checkbox" checked={onlyAttention} onChange={(e) => setOnlyAttention(e.target.checked)} />
          Mostrar só o que acaba em até 7 dias
        </label>
        {!visible.length ? (
          <NoData>{onlyAttention ? "Nenhum produto acabando nos próximos 7 dias. 👍" : "Sem vendas nos últimos 30 dias."}</NoData>
        ) : (
          <div className="rpt-table-scroll">
            <table className="rpt-table">
              <thead>
                <tr><th>Produto</th><th>Estoque</th><th>Vende/dia</th><th>Acaba em</th><th>Situação</th><th>Comprar</th></tr>
              </thead>
              <tbody>
                {visible.map((f) => (
                  <tr key={f.id}>
                    <td className="rpt-product-name">{f.name}</td>
                    <td className="rpt-qty">{f.stock}</td>
                    <td className="rpt-qty">{fmtNum(f.avgDaily)}</td>
                    <td className="rpt-qty">{f.stock <= 0 ? "—" : formatDays(f.daysLeft)}</td>
                    <td><span className={`rpt-badge rpt-badge-${STATUS[f.status].tone}`}>{STATUS[f.status].label}</span></td>
                    <td className="rpt-revenue">
                      {f.toBuy > 0 ? (
                        <>
                          {f.toBuy} un.
                          {f.packSuggestion && (
                            <small className="rpt-cell-sub">
                              ≈ {f.packSuggestion.packs} × {f.packSuggestion.name}
                            </small>
                          )}
                        </>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="🧊 Produtos parados"
        hint={`Com estoque e sem nenhuma venda nos últimos ${idleDays} dias — dinheiro parado na prateleira${idleCapital > 0 ? `: ${formatBRL(idleCapital)} a preço de custo` : ""}.`}
        actions={<Segmented options={IDLE_OPTIONS} value={idleDays} onChange={setIdleDays} />}
      >
        {!idle.length ? (
          <NoData>Nenhum produto parado. 👍</NoData>
        ) : (
          <div className="rpt-table-scroll">
            <table className="rpt-table">
              <thead>
                <tr><th>Produto</th><th>Estoque</th><th>Última venda</th><th>Dinheiro parado</th></tr>
              </thead>
              <tbody>
                {idle.map((p) => (
                  <tr key={p.id}>
                    <td className="rpt-product-name">{p.name}</td>
                    <td className="rpt-qty">{p.stock}</td>
                    <td className="rpt-qty">{p.lastSaleAt ? `há ${p.daysIdle} dias` : "nenhuma em 12 meses"}</td>
                    <td className="rpt-revenue">{p.capital != null ? formatBRL(p.capital) : "sem custo"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
