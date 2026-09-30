import { useCallback, useEffect, useRef, useState } from "react";
import { listStockMovements, undoProductPurchase } from "../services/stockService";
import { useStockMovementsRealtime } from "../hooks/useStockMovementsRealtime";
import UndoPurchaseModal from "./UndoPurchaseModal";

const REASON_ICON = {
  venda: "🛒",
  cancelamento: "↩️",
  ajuste_manual: "✏️",
  compra: "📦",
};

const REASON_FILTERS = [
  { value: "todos", label: "Todas" },
  { value: "venda", label: "Vendas" },
  { value: "cancelamento", label: "Cancelamentos" },
  { value: "ajuste_manual", label: "Ajustes manuais" },
  { value: "compra", label: "Compras" },
];

export default function EstoqueView() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  const [reasonFilter, setReasonFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [movementToUndo, setMovementToUndo] = useState(null);
  const [undoing, setUndoing] = useState(false);
  const [undoError, setUndoError] = useState("");

  const fetchPage = useCallback(async (nextPage, append, filters) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const result = await listStockMovements({ page: nextPage, ...filters });
      setMovements((prev) => (append ? [...prev, ...result.movements] : result.movements));
      setHasMore(result.hasMore);
      setCount(result.count);
      setError("");
    } catch (e) {
      setError(e.message);
    }
    if (append) setLoadingMore(false);
    else setLoading(false);
  }, []);

  // Busca por nome dispara com debounce (evita uma consulta por tecla);
  // trocar o filtro de tipo é instantâneo, já que não depende de digitação.
  const debounceRef = useRef(null);
  useEffect(() => {
    setPage(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPage(0, false, { reason: reasonFilter, search });
    }, search ? 400 : 0);
    return () => clearTimeout(debounceRef.current);
  }, [fetchPage, reasonFilter, search]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPage(nextPage, true, { reason: reasonFilter, search });
  };

  // Recarrega quando OUTRO terminal gera uma movimentação (venda, compra,
  // cancelamento, ajuste) — volta pra página 0 com os filtros atuais, mesmo
  // padrão já usado depois de "Desfazer compra" (confirmUndo).
  const handleRealtimeChange = useCallback(() => {
    setPage(0);
    fetchPage(0, false, { reason: reasonFilter, search });
  }, [fetchPage, reasonFilter, search]);
  useStockMovementsRealtime(handleRealtimeChange);

  const dismissUndo = () => {
    if (undoing) return;
    setMovementToUndo(null);
    setUndoError("");
  };

  const confirmUndo = async () => {
    if (!movementToUndo) return;
    setUndoing(true);
    setUndoError("");
    try {
      await undoProductPurchase(movementToUndo.id);
      setMovementToUndo(null);
      setPage(0);
      await fetchPage(0, false, { reason: reasonFilter, search });
    } catch (e) {
      setUndoError(e.message);
    }
    setUndoing(false);
  };

  return (
    <>
      {movementToUndo && (
        <UndoPurchaseModal
          movement={movementToUndo}
          undoing={undoing}
          undoError={undoError}
          onConfirm={confirmUndo}
          onDismiss={dismissUndo}
        />
      )}

      <div className="adm-title-row">
        <div>
          <h1 className="adm-title">Movimentação de Estoque</h1>
          <p className="adm-subtitle">
            Toda entrada e saída de estoque — vendas, cancelamentos e ajustes manuais.
          </p>
        </div>
      </div>

      <div className="adm-product-filters">
        <input
          className="adm-product-search"
          placeholder="🔍 Buscar por produto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="adm-product-cat-filter"
          value={reasonFilter}
          onChange={(e) => setReasonFilter(e.target.value)}
        >
          {REASON_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="adm-modal-error">⚠️ {error}</div>}

      {loading ? (
        <div className="adm-loading">
          <div className="adm-spinner" />
          <p>Carregando...</p>
        </div>
      ) : movements.length === 0 ? (
        <div className="adm-empty"><p>Nenhuma movimentação encontrada.</p></div>
      ) : (
        <div className="adm-product-table-wrap">
          <table className="adm-product-table">
            <thead>
              <tr>
                {["ID", "Produto", "Movimento", "Origem", "Quando", "Ações"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="adm-td-id">{m.productId}</td>
                  <td className="adm-td-name">{m.productName}</td>
                  <td>
                    <span className={`adm-stock-badge ${m.quantity < 0 ? "zero" : "ok"}`}>
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </span>
                  </td>
                  <td>
                    {REASON_ICON[m.reason] ?? ""} {m.origin}
                  </td>
                  <td>
                    {new Date(m.createdAt).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="adm-td-actions">
                    {m.reason === "compra" && (
                      <button
                        className="adm-btn-delete"
                        title="Desfazer essa compra"
                        onClick={() => setMovementToUndo(m)}
                      >
                        ↩️ Desfazer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {hasMore && (
            <div className="adm-load-more-wrap">
              <button className="adm-load-more" onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore ? (
                  <>
                    <div className="adm-spinner-sm" /> Carregando...
                  </>
                ) : (
                  `Carregar mais (${movements.length} de ${count})`
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
