import { useEffect, useState } from "react";
import { formatBRL } from "../../../shared/utils/format";
import { listPastCashSessions } from "../../caixa/services/cashSessionService";
import { listSessionSales, listSessionFiadoPayments } from "../../../shared/services/salesService";
import { SalesSummary, SalesRows, summarize } from "./SalesParts";

const dayLabel = (iso) => {
  const label = new Date(iso).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "2-digit" });
  return label.charAt(0).toUpperCase() + label.slice(1);
};
const timeLabel = (iso) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—");

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function differenceOf(session) {
  if (session.declared == null || session.expected == null) return null;
  return Math.round((session.declared - session.expected) * 100) / 100;
}

function DifferenceTag({ value }) {
  if (value == null) return null;
  if (Math.abs(value) < 0.005) return <span className="pdv-past-diff pdv-past-diff-ok">Bateu</span>;
  return (
    <span className={`pdv-past-diff ${value < 0 ? "pdv-past-diff-short" : "pdv-past-diff-over"}`}>
      {value < 0 ? "Faltou" : "Sobrou"} {formatBRL(Math.abs(value))}
    </span>
  );
}

// Caixa já fechado: só consulta e reimpressão — cancelar não é mais
// possível (o banco recusa venda de caixa fechado).
export default function PastCashSessions({ onPrint }) {
  const [date, setDate] = useState("");
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSessionsLoading(true);
      setError("");
      try {
        const data = await listPastCashSessions({ date: date || undefined });
        if (cancelled) return;
        setSessions(data);
        setSelectedId(data[0]?.id ?? null);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
      if (!cancelled) setSessionsLoading(false);
    }, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [date]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setDetailLoading(true);
      try {
        const [sales, fiadoPayments] = await Promise.all([
          listSessionSales(selectedId),
          listSessionFiadoPayments(selectedId),
        ]);
        if (!cancelled) setDetail({ sales, fiadoPayments });
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
      if (!cancelled) setDetailLoading(false);
    }, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [selectedId]);

  const selected = sessions.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="pdv-past-sessions">
      <aside className="pdv-past-list">
        <div className="pdv-past-date">
          <label htmlFor="pdv-past-date-input">Ir para o dia</label>
          <div className="pdv-past-date-row">
            <input
              id="pdv-past-date-input"
              type="date"
              value={date}
              max={todayLocal()}
              onChange={(e) => setDate(e.target.value)}
            />
            {date && (
              <button type="button" className="adm-btn-back" onClick={() => setDate("")}>
                Limpar
              </button>
            )}
          </div>
        </div>

        {sessionsLoading ? (
          <div className="adm-loading"><div className="adm-spinner" /></div>
        ) : sessions.length === 0 ? (
          <div className="adm-empty"><p>{date ? "Nenhum caixa fechado nesse dia." : "Nenhum caixa fechado ainda."}</p></div>
        ) : (
          sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`pdv-past-item ${s.id === selectedId ? "active" : ""}`}
              onClick={() => setSelectedId(s.id)}
            >
              <span className="pdv-past-item-day">{dayLabel(s.openedAt)}</span>
              <span className="pdv-past-item-meta">
                {timeLabel(s.openedAt)} → {timeLabel(s.closedAt)} · {s.orderCount} venda(s)
              </span>
              <DifferenceTag value={differenceOf(s)} />
            </button>
          ))
        )}
        {!date && sessions.length > 0 && (
          <p className="pdv-past-hint">Mostrando os últimos {sessions.length} caixas. Pra um dia mais antigo, use a data acima.</p>
        )}
      </aside>

      <section className="pdv-past-detail">
        {error && <div className="adm-modal-error">⚠️ {error}</div>}

        {selected && (
          <div className="pdv-past-close">
            <div className="pdv-past-close-head">
              <strong>Caixa de {dayLabel(selected.openedAt).toLowerCase()}</strong>
              <span>
                Aberto às {timeLabel(selected.openedAt)} · fechado às {timeLabel(selected.closedAt)}
                {selected.closedAt && new Date(selected.closedAt).toDateString() !== new Date(selected.openedAt).toDateString()
                  ? ` de ${new Date(selected.closedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`
                  : ""}
              </span>
            </div>
            <div className="pdv-past-close-grid">
              <div><span>Valor inicial</span><strong>{formatBRL(selected.openingAmount)}</strong></div>
              <div><span>Dinheiro esperado</span><strong>{selected.expected != null ? formatBRL(selected.expected) : "—"}</strong></div>
              <div><span>Contado no fechamento</span><strong>{selected.declared != null ? formatBRL(selected.declared) : "—"}</strong></div>
              <div><span>Diferença</span><strong><DifferenceTag value={differenceOf(selected)} /></strong></div>
            </div>
          </div>
        )}

        {detailLoading ? (
          <div className="adm-loading"><div className="adm-spinner" /><p>Carregando vendas...</p></div>
        ) : detail ? (
          <>
            {(detail.sales.length > 0 || detail.fiadoPayments.length > 0) && (
              <SalesSummary summary={summarize(detail.sales, detail.fiadoPayments)} />
            )}
            {detail.sales.length === 0 ? (
              <div className="adm-empty"><p>Nenhuma venda nesse caixa.</p></div>
            ) : (
              <SalesRows sales={detail.sales} canCancel={() => false} onPrint={onPrint} />
            )}
          </>
        ) : null}
      </section>
    </div>
  );
}
