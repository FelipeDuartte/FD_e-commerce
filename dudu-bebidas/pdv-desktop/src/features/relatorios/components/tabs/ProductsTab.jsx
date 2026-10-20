import { useState } from "react";
import { formatBRL } from "../../../../shared/utils/format";
import { Section, NoData, Segmented, fmtPct } from "../ReportBits";

const RANK_MEDALS = ["🥇", "🥈", "🥉"];
const rankMedal = (i) => RANK_MEDALS[i] ?? i + 1;

const ABC_HINT = {
  A: "Fazem 80% do faturamento — nunca podem faltar.",
  B: "Vendem bem — acompanhe.",
  C: "Vendem pouco — avalie se vale manter.",
};

export default function ProductsTab({ data }) {
  const { topProducts, byCategory, abc, packVsUnit } = data;
  const [abcFilter, setAbcFilter] = useState("A");
  const abcRows = abc.rows.filter((r) => r.cls === abcFilter);

  return (
    <>
      <div className="rpt-two-col">
        <Section title="🏅 Produtos mais vendidos" hint="Inclui vendas fiado — o produto saiu da loja.">
          {!topProducts.length ? (
            <NoData />
          ) : (
            <table className="rpt-table">
              <thead>
                <tr><th>#</th><th>Produto</th><th>Qtd.</th><th>Faturado</th></tr>
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
        </Section>

        <Section title="🗂️ Vendas por categoria">
          {!byCategory.length ? (
            <NoData />
          ) : (
            <div className="rpt-payment-list">
              {byCategory.map((c) => (
                <div className="rpt-payment-row" key={c.category}>
                  <div className="rpt-payment-row-top">
                    <span className="rpt-payment-label rpt-capitalize">{c.category}</span>
                    <span className="rpt-payment-amount">{formatBRL(c.revenue)}</span>
                  </div>
                  <div className="rpt-payment-bar-track">
                    <div className="rpt-payment-bar-fill" style={{ width: `${c.pct}%` }} />
                  </div>
                  <span className="rpt-payment-pct">{fmtPct(c.pct, 1)} · {c.quantity} un.</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <Section
        title="🔤 Curva ABC"
        hint="Produtos separados pelo peso no faturamento do período."
        actions={
          <Segmented
            value={abcFilter}
            onChange={setAbcFilter}
            options={abc.summary.map((s) => ({ value: s.cls, label: `${s.cls} · ${s.count}` }))}
          />
        }
      >
        {!abc.rows.length ? (
          <NoData />
        ) : (
          <>
            <div className="rpt-abc-summary">
              {abc.summary.map((s) => (
                <div key={s.cls} className={`rpt-abc-card rpt-abc-${s.cls}`}>
                  <strong>Classe {s.cls}</strong>
                  <span>{s.count} produto(s) · {fmtPct(s.pct)} do faturamento</span>
                  <small>{ABC_HINT[s.cls]}</small>
                </div>
              ))}
            </div>
            <table className="rpt-table">
              <thead>
                <tr><th>Produto</th><th>Qtd.</th><th>Faturado</th><th>% do total</th><th>Acumulado</th></tr>
              </thead>
              <tbody>
                {abcRows.map((r) => (
                  <tr key={r.name}>
                    <td className="rpt-product-name">
                      <span className={`rpt-badge rpt-abc-badge-${r.cls}`}>{r.cls}</span> {r.name}
                    </td>
                    <td className="rpt-qty">{r.quantity}</td>
                    <td className="rpt-revenue">{formatBRL(r.revenue)}</td>
                    <td className="rpt-qty">{fmtPct(r.pct, 1)}</td>
                    <td className="rpt-qty">{fmtPct(r.cumulativePct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Section>

      <Section
        title="📦 Fardo × unidade"
        hint="Quanto de cada produto saiu avulso e quanto saiu em fardo/caixa, e o preço médio por unidade em cada forma."
      >
        {!packVsUnit.length ? (
          <NoData>Nenhum produto com fardo vendido no período.</NoData>
        ) : (
          <table className="rpt-table">
            <thead>
              <tr><th>Produto</th><th>Avulso</th><th>Em fardo</th><th>% em fardo</th><th>R$/un. avulso</th><th>R$/un. no fardo</th></tr>
            </thead>
            <tbody>
              {packVsUnit.map((r) => (
                <tr key={r.name}>
                  <td className="rpt-product-name" title={r.packNames}>{r.name}</td>
                  <td className="rpt-qty">{r.unitQty} un.</td>
                  <td className="rpt-qty">{r.packQty} fardo(s) · {r.packUnits} un.</td>
                  <td className="rpt-qty">{fmtPct(r.packSharePct)}</td>
                  <td className="rpt-revenue">{r.unitPrice != null ? formatBRL(r.unitPrice) : "—"}</td>
                  <td className="rpt-revenue">{r.packUnitPrice != null ? formatBRL(r.packUnitPrice) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </>
  );
}
