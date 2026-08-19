import { useCallback, useEffect, useState } from "react";
import { listStockMovements } from "./services/adminStockService";

const REASON_ICON = {
  venda: "🛒",
  cancelamento: "↩️",
  ajuste_manual: "✏️",
};

export default function AdminStock() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");

  const fetchPage = useCallback(async (nextPage, append) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const result = await listStockMovements({ page: nextPage });
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

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPage(0, false);
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchPage]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPage(nextPage, true);
  };

  return (
    <>
      <div className="adm-title-row">
        <div>
          <h1 className="adm-title">Movimentação de Estoque</h1>
          <p className="adm-subtitle">
            Toda entrada e saída de estoque — vendas, cancelamentos e ajustes manuais.
          </p>
        </div>
      </div>

      {error && <div className="adm-modal-error">⚠️ {error}</div>}

      {loading ? (
        <div className="adm-loading">
          <div className="adm-spinner" />
          <p>Carregando...</p>
        </div>
      ) : movements.length === 0 ? (
        <div className="adm-empty"><p>Nenhuma movimentação registrada ainda.</p></div>
      ) : (
        <div className="adm-product-table-wrap">
          <table className="adm-product-table">
            <thead>
              <tr>
                {["Produto", "Movimento", "Origem", "Quando"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
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
