import { useMemo, useState } from "react";
import { formatBRL } from "../../../../shared/utils/format";
import { Section, NoData, Segmented, MarginBadge, fmtPct } from "../ReportBits";

const SORTS = [
  { value: "profit", label: "Mais lucro" },
  { value: "margin", label: "Menor margem" },
  { value: "revenue", label: "Mais faturado" },
];

function sortRows(rows, sort) {
  const copy = [...rows];
  if (sort === "margin") return copy.sort((a, b) => (a.marginPct ?? Infinity) - (b.marginPct ?? Infinity));
  if (sort === "revenue") return copy.sort((a, b) => b.revenue - a.revenue);
  return copy.sort((a, b) => (b.profit ?? -Infinity) - (a.profit ?? -Infinity));
}

export default function MarginsTab({ data }) {
  const { margins, cash } = data;
  const [sort, setSort] = useState("profit");
  const rows = useMemo(() => sortRows(margins.rows, sort), [margins.rows, sort]);

  return (
    <>
      <div className="rpt-two-col">
        <Section title="💹 Lucro das vendas" hint="Quanto sobrou dos produtos vendidos depois do custo deles (inclui vendas fiado).">
          <div className="rpt-result">
            <div className="rpt-result-row"><span>Vendido (já com descontos)</span><strong>{formatBRL(margins.totals.revenue)}</strong></div>
            <div className="rpt-result-row rpt-result-minus"><span>(−) Custo dos produtos</span><strong>{formatBRL(margins.totals.cost)}</strong></div>
            <div className="rpt-result-row rpt-result-total">
              <span>Lucro bruto</span>
              <strong>{formatBRL(margins.totals.profit)} · {fmtPct(margins.totals.marginPct, 1)}</strong>
            </div>
            {margins.noCostRevenue > 0 && (
              <p className="rpt-result-note">
                ⚠️ {formatBRL(margins.noCostRevenue)} em vendas de produtos sem custo cadastrado ficaram de fora — aparecem como “sem custo” na tabela de produtos.
              </p>
            )}
          </div>
        </Section>

        <Section title="🏦 Caixa do período" hint="Dinheiro que entrou menos as contas pagas (Contas a Pagar), loja inteira.">
          <div className="rpt-result">
            <div className="rpt-result-row"><span>Entrou (vendas + fiado recebido)</span><strong>{formatBRL(cash.received)}</strong></div>
            <div className="rpt-result-row rpt-result-minus"><span>(−) Contas pagas</span><strong>{formatBRL(cash.paid)}</strong></div>
            <div className={`rpt-result-row rpt-result-total ${cash.balance < 0 ? "rpt-result-negative" : ""}`}>
              <span>Sobrou no caixa</span><strong>{formatBRL(cash.balance)}</strong>
            </div>
            {cash.billsByCategory.length > 0 && (
              <div className="rpt-result-breakdown">
                {cash.billsByCategory.map((b) => (
                  <div key={b.category} className="rpt-result-row rpt-result-sub">
                    <span>{b.category}</span><span>{formatBRL(b.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            {cash.bonusUnits > 0 && (
              <p className="rpt-result-note">
                🎁 Bonificações recebidas: {cash.bonusUnits} un. — valor de venda estimado {formatBRL(cash.bonusValue)}.
              </p>
            )}
          </div>
        </Section>
      </div>

      {margins.belowCost.length > 0 && (
        <div className="rpt-alert rpt-alert-bad">
          <strong>🚨 Vendidos abaixo do custo ({margins.belowCost.length})</strong>
          <span>{margins.belowCost.map((r) => `${r.name} (${formatBRL(r.profit)})`).join(" · ")}</span>
        </div>
      )}

      <Section title="🗂️ Margem por categoria">
        {!margins.byCategory.length ? (
          <NoData />
        ) : (
          <table className="rpt-table">
            <thead>
              <tr><th>Categoria</th><th>Vendido</th><th>Custo</th><th>Lucro</th><th>Margem</th></tr>
            </thead>
            <tbody>
              {margins.byCategory.map((c) => (
                <tr key={c.category}>
                  <td className="rpt-product-name rpt-capitalize">{c.category}</td>
                  <td className="rpt-revenue">{formatBRL(c.revenue)}</td>
                  <td className="rpt-qty">{formatBRL(c.cost)}</td>
                  <td className="rpt-revenue">{formatBRL(c.profit)}</td>
                  <td><MarginBadge pct={c.marginPct} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section
        title="🏷️ Margem por produto"
        hint="Custo de cada venda = o da última compra antes dela."
        actions={<Segmented options={SORTS} value={sort} onChange={setSort} />}
      >
        {!rows.length ? (
          <NoData />
        ) : (
          <div className="rpt-table-scroll">
            <table className="rpt-table">
              <thead>
                <tr><th>Produto</th><th>Qtd.</th><th>Vendido</th><th>Custo</th><th>Lucro</th><th>Margem</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.productId ?? r.name}>
                    <td className="rpt-product-name">{r.name}</td>
                    <td className="rpt-qty">{r.quantity}</td>
                    <td className="rpt-revenue">{formatBRL(r.revenue)}</td>
                    <td className="rpt-qty">{r.missingCost ? "—" : formatBRL(r.cost)}</td>
                    <td className="rpt-revenue">{r.profit == null ? "—" : formatBRL(r.profit)}</td>
                    <td><MarginBadge pct={r.marginPct} /></td>
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
