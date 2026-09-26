import { useState } from "react";
import { PAGE_SIZE } from "../orderStatus";
import { formatBRL } from "../../../shared/utils/adminFormat";
import { useVariableVirtualList } from "../useVariableVirtualList";
import OrderCard from "./OrderCard";
import CourierMapOverview from "./CourierMapOverview";

const STAT_FILTERS = [
  { key: "all", icon: null, countKey: "all", label: "Total" },
  { key: "pending", icon: "🕐", countKey: "pending", label: "Aguardando" },
  { key: "preparing", icon: "👨‍🍳", countKey: "preparing", label: "Preparando" },
  { key: "on_the_way", icon: "🛵", countKey: "on_the_way", label: "Em entrega" },
  { key: "delivered", icon: "✅", countKey: "delivered", label: "Entregue" },
  { key: "rejected", icon: "❌", countKey: "rejected", label: "Rejeitado" },
  { key: "cancelled", icon: "🚫", countKey: "cancelled", label: "Cancelado" },
];

export default function OrdersTab({
  orders, loading, loadingMore, hasMore, totalCount, ordersError, updating,
  filterStatus, setFilterStatus, expandedId, setExpandedId, metrics, counts,
  advanceStatus, setStatus, markPaid, couriers, assignCourier, onReject, handleLoadMore,
}) {
  const { containerRef, totalHeight, offsets, start, end, measureRef } =
    useVariableVirtualList(orders.length, 90, 3);

  const [showMap, setShowMap] = useState(false);

  return (
    <>
      <div className="adm-title-row">
        <div>
          <h1 className="adm-title">Painel de Pedidos</h1>
          <p className="adm-subtitle">
            {orders.length} pedido(s) · tempo real
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="adm-load-more" onClick={() => setShowMap((v) => !v)}>
            {showMap ? "Ocultar mapa" : "🗺️ Ver no mapa"}
          </button>
          <div className="adm-realtime-dot" aria-label="Tempo real">
            <span className="adm-dot-pulse" />
            <span>Ao vivo</span>
          </div>
        </div>
      </div>

      {showMap && <CourierMapOverview />}

      <div className="adm-today-metrics">
        {[
          { icon: "📅", value: metrics.count, label: "Pedidos hoje" },
          { icon: "💰", value: formatBRL(metrics.total), label: "Vendas hoje" },
        ].map(({ icon, value, label }) => (
          <div key={label} className="adm-metric-card">
            <div className="adm-metric-icon">{icon}</div>
            <div className="adm-metric-content">
              <span className="adm-metric-value">{value}</span>
              <span className="adm-metric-label">{label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="adm-stats" role="group" aria-label="Filtrar por status">
        {STAT_FILTERS.map(({ key, icon, countKey, label }) => (
          <button
            key={key}
            className={`adm-stat adm-stat-${key} ${filterStatus === key ? "adm-stat-active" : ""}`}
            onClick={() => setFilterStatus(key)}
            aria-pressed={filterStatus === key}
          >
            {icon && <span className="adm-stat-icon">{icon}</span>}
            <span className="adm-stat-num">{counts[countKey]}</span>
            <span className="adm-stat-label">{label}</span>
          </button>
        ))}
      </div>

      {ordersError ? (
        <div className="adm-modal-error">⚠️ {ordersError}</div>
      ) : loading ? (
        <div className="adm-loading">
          <div className="adm-spinner" />
          <p>Carregando pedidos...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="adm-empty">
          <p>Nenhum pedido encontrado.</p>
        </div>
      ) : (
        <>
          <div ref={containerRef} className="adm-virtual-container">
            <div style={{ height: totalHeight, position: "relative" }}>
              {orders.slice(start, end + 1).map((order, relIdx) => {
                const absIdx = start + relIdx;
                return (
                  <div
                    key={order.id}
                    ref={measureRef(absIdx)}
                    style={{
                      position: "absolute",
                      top: offsets[absIdx],
                      left: 0,
                      right: 0,
                    }}
                  >
                    <OrderCard
                      order={order}
                      isExpanded={expandedId === order.id}
                      isUpdating={updating === order.id}
                      onToggle={() =>
                        setExpandedId((p) => (p === order.id ? null : order.id))
                      }
                      onAccept={() => advanceStatus(order)}
                      onReject={() => onReject(order)}
                      onAdvance={() => advanceStatus(order)}
                      onSetStatus={(s) => setStatus(order.id, s)}
                      onMarkPaid={() => markPaid(order.id)}
                      couriers={couriers}
                      onAssignCourier={(courier) => assignCourier(order.id, courier, order.address)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {hasMore && (
            <div className="adm-load-more-wrap">
              <button
                className="adm-load-more"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <div className="adm-spinner-sm" /> Carregando...
                  </>
                ) : (
                  `Carregar mais (${orders.length} de ${totalCount})`
                )}
              </button>
            </div>
          )}

          {!hasMore && orders.length > PAGE_SIZE && (
            <div className="adm-end-msg">
              ✓ Todos os {totalCount} pedidos carregados
            </div>
          )}
        </>
      )}
    </>
  );
}
