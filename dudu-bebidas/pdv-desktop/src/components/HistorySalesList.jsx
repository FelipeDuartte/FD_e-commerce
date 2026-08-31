import { formatBRL } from "../utils/format";
import { PAYMENT_METHODS } from "../constants";

export default function HistorySalesList({ cancelError, sessionSales, cancellingId, onCancelSale }) {
  return (
    <div className="pdv-session-sales">
      <h2 className="adm-store-section-title">Vendas desta sessão</h2>
      {cancelError && <div className="adm-modal-error">⚠️ {cancelError}</div>}
      {sessionSales.length === 0 ? (
        <div className="adm-empty"><p>Nenhuma venda registrada ainda nesta sessão.</p></div>
      ) : (
        <div className="pdv-sales-list">
          {sessionSales.map((sale) => {
            const method = PAYMENT_METHODS.find((m) => m.value === sale.paymentMethod);
            return (
              <div
                key={sale.orderId}
                className={`pdv-sale-row ${sale.cancelled ? "pdv-sale-cancelled" : ""}`}
              >
                <span className="pdv-sale-time">
                  {new Date(sale.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="pdv-sale-items" title={sale.itemsLabel}>
                  {sale.itemsLabel || `${sale.itemCount} item(ns)`}
                </span>
                <span>{method ? `${method.icon} ${method.label}` : sale.paymentMethod}</span>
                <strong>{formatBRL(sale.total)}</strong>
                {sale.cancelled ? (
                  <span className="pdv-sale-cancelled-label">Cancelada</span>
                ) : (
                  <button
                    className="adm-btn-delete"
                    onClick={() => onCancelSale(sale)}
                    disabled={cancellingId === sale.orderId}
                  >
                    {cancellingId === sale.orderId ? "..." : "🗑️ Cancelar"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
