import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase/Supabaseclient";
import "./Admin.css";

// ── Constantes ────────────────────────────────────────
const PAGE_SIZE = 20;

const STATUS_PICKUP = {
  pending: {
    label: "Aguardando",
    icon: "🕐",
    color: "#ffd000",
    next: "delivered",
  },
  delivered: { label: "Entregue", icon: "✅", color: "#50c878", next: null },
};

const STATUS_DELIVERY = {
  pending: {
    label: "Aguardando",
    icon: "🕐",
    color: "#ffd000",
    next: "preparing",
  },
  preparing: {
    label: "Preparando",
    icon: "👨‍🍳",
    color: "#ff8c00",
    next: "on_the_way",
  },
  on_the_way: {
    label: "Em entrega",
    icon: "🛵",
    color: "#50c878",
    next: "delivered",
  },
  delivered: { label: "Entregue", icon: "✅", color: "#aaa", next: null },
};

const DELIVERY_STATUS_ORDER = [
  "pending",
  "preparing",
  "on_the_way",
  "delivered",
];
const PICKUP_STATUS_ORDER = ["pending", "delivered"];

const PAYMENT_LABEL = {
  pix: { icon: "⚡", label: "PIX" },
  card: { icon: "💳", label: "Cartão" },
  cash: { icon: "💵", label: "Dinheiro" },
};

// ── Helpers puros ─────────────────────────────────────
const isPickup = (order) => order.address?.isRetirada === true;
const getConfig = (order) =>
  (isPickup(order) ? STATUS_PICKUP : STATUS_DELIVERY)[order.status] ??
  STATUS_DELIVERY.pending;
const getStatuses = (order) =>
  isPickup(order) ? PICKUP_STATUS_ORDER : DELIVERY_STATUS_ORDER;
const getNext = (order) => getConfig(order).next;

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
const formatBRL = (value) => `R$ ${Number(value).toFixed(2).replace(".", ",")}`;

// ── Reducer de métricas ───────────────────────────────
const initialMetrics = { count: 0, total: 0 };
const metricsReducer = (_, action) => ({
  count: action.count,
  total: action.total,
});

// ══════════════════════════════════════════════════════
//  Hook: virtualização com alturas MEDIDAS por ResizeObserver
const GAP = 10;

function useVariableVirtualList(count, estimatedItemHeight = 90, overscan = 3) {
  const containerRef = useRef(null);
  const heightsRef = useRef({});
  const observersRef = useRef({});
  const [, forceUpdate] = useReducer((n) => n + 1, 0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(700);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setViewH(e.contentRect.height));
    ro.observe(el);
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  const offsets = [];
  let acc = 0;
  for (let i = 0; i < count; i++) {
    offsets.push(acc);
    acc += (heightsRef.current[i] ?? estimatedItemHeight) + GAP;
  }
  const totalHeight = acc;

  let start = 0;
  while (
    start < count - 1 &&
    offsets[start + 1] <= scrollTop - overscan * estimatedItemHeight
  )
    start++;
  let end = start;
  while (
    end < count - 1 &&
    offsets[end] <= scrollTop + viewH + overscan * estimatedItemHeight
  )
    end++;

  const measureRef = useCallback(
    (index) => (el) => {
      if (observersRef.current[index]) {
        observersRef.current[index].disconnect();
        delete observersRef.current[index];
      }
      if (!el) return;
      const ro = new ResizeObserver(([e]) => {
        const h = Math.round(e.contentRect.height);
        if (heightsRef.current[index] !== h) {
          heightsRef.current[index] = h;
          forceUpdate();
        }
      });
      ro.observe(el);
      observersRef.current[index] = ro;
    },
    [forceUpdate],
  );

  useEffect(() => {
    const obs = observersRef.current;
    return () => {
      Object.values(obs).forEach((ro) => ro.disconnect());
    };
  }, []);

  return { containerRef, totalHeight, offsets, start, end, measureRef };
}

// ── Helper: toca o som de notificação ─────────────────
function playNotificationSound() {
  try {
    const audio = new Audio("/notification.mp3");
    audio.volume = 1;
    audio.play().catch(() => {});
  } catch {
    // sem suporte a Audio
  }
}

// ── Componente principal ──────────────────────────────
export default function Admin({ user, isAdmin }) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [updating, setUpdating] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  const [metrics, dispatchMetrics] = useReducer(metricsReducer, initialMetrics);

  const [rejectModal, setRejectModal] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState("");





  // ── Métricas do dia ───────────────────────────────
  const fetchTodayMetrics = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const { data, count, error } = await supabase
      .from("orders")
      .select("total", { count: "exact" })
      .gte("created_at", today.toISOString())
      .lt("created_at", tomorrow.toISOString());
    if (!error && data)
      dispatchMetrics({
        count: count ?? 0,
        total: data.reduce((s, o) => s + (o.total ?? 0), 0),
      });
  }, []);

  // ── Fetch pedidos ─────────────────────────────────
  const fetchOrders = useCallback(
    async (pageNum = 0, reset = false) => {
      pageNum === 0 ? setLoading(true) : setLoadingMore(true);
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("orders")
        .select(
          `id, total, payment_method, address, status, created_at,
         order_items ( id, name, price, quantity )`,
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (filterStatus !== "all") query = query.eq("status", filterStatus);

      const { data, error, count } = await query;
      if (!error) {
        const newOrders = data ?? [];
        setOrders((prev) =>
          reset || pageNum === 0 ? newOrders : [...prev, ...newOrders],
        );
        setHasMore(newOrders.length === PAGE_SIZE);
        if (count !== null) setTotalCount(count);
      }
      pageNum === 0 ? setLoading(false) : setLoadingMore(false);
    },
    [filterStatus],
  );

  // ── Efeitos ───────────────────────────────────────

  // Carrega pedidos e métricas na inicialização
  useEffect(() => {
    if (!isAdmin) return;
    fetchOrders(0, true);
    fetchTodayMetrics();
  }, [isAdmin, fetchOrders, fetchTodayMetrics]);

  // Canal Realtime isolado — não recria quando fetchOrders muda
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        () => {
          playNotificationSound();
          fetchOrders(0, true);
          fetchTodayMetrics();
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [isAdmin]); // eslint-disable-line

  useEffect(() => {
    if (!isAdmin) return;
    setPage(0);
    setOrders([]);
    setHasMore(true);
    fetchOrders(0, true);
  }, [filterStatus]); // eslint-disable-line

  // ── Ações ─────────────────────────────────────────
  // Atualiza o status de um order no estado local sem precisar recarregar
  const updateOrderStatusLocally = useCallback((orderId, newStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)),
    );
  }, []);

  const advanceStatus = useCallback(async (order) => {
    const next = getNext(order);
    if (!next) return;
    setUpdating(order.id);
    const { error } = await supabase
      .from("orders")
      .update({ status: next })
      .eq("id", order.id);
    if (!error) updateOrderStatusLocally(order.id, next);
    setUpdating(null);
  }, [updateOrderStatusLocally]);

  const setStatus = useCallback(async (orderId, newStatus) => {
    setUpdating(orderId);
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);
    if (!error) updateOrderStatusLocally(orderId, newStatus);
    setUpdating(null);
  }, [updateOrderStatusLocally]);

  const confirmReject = useCallback(async () => {
    if (!rejectModal) return;
    setRejecting(true);
    setRejectError("");
    const { error: itemsErr } = await supabase
      .from("order_items")
      .delete()
      .eq("order_id", rejectModal);
    if (itemsErr) {
      setRejectError("Erro ao remover itens.");
      setRejecting(false);
      return;
    }
    const { error: orderErr } = await supabase
      .from("orders")
      .delete()
      .eq("id", rejectModal);
    if (orderErr) {
      setRejectError("Erro ao rejeitar pedido.");
      setRejecting(false);
      return;
    }
    // Remove da lista local sem precisar recarregar
    setOrders((prev) => prev.filter((o) => o.id !== rejectModal));
    setTotalCount((prev) => prev - 1);
    setRejectModal(null);
    setRejecting(false);
  }, [rejectModal]);

  const closeRejectModal = useCallback(() => {
    if (rejecting) return;
    setRejectModal(null);
    setRejectError("");
  }, [rejecting]);

  const handleLoadMore = useCallback(() => {
    const next = page + 1;
    setPage(next);
    fetchOrders(next);
  }, [page, fetchOrders]);

  const counts = orders.reduce(
    (acc, o) => {
      acc.all++;
      if (o.status in acc) acc[o.status]++;
      return acc;
    },
    { all: 0, pending: 0, preparing: 0, on_the_way: 0, delivered: 0 },
  );

  // ── Virtualização ─────────────────────────────────
  const { containerRef, totalHeight, offsets, start, end, measureRef } =
    useVariableVirtualList(orders.length, 90, 3);

  // ── Guards ────────────────────────────────────────
  if (isAdmin === null) {
    return (
      <div className="adm-root">
        <div className="adm-wrap">
          <div className="adm-loading">
            <div className="adm-spinner" />
            <p>Verificando acesso...</p>
          </div>
        </div>
      </div>
    );
  }
  if (!isAdmin) return null;

  // ── Render ────────────────────────────────────────
  return (
    <div className="adm-root">
      <div className="adm-wrap">
        {/* MODAL */}
        {rejectModal && (
          <>
            <div className="adm-modal-overlay" onClick={closeRejectModal} />
            <div className="adm-modal" role="dialog" aria-modal="true">
              <div className="adm-modal-icon">🚫</div>
              <h3 className="adm-modal-title">Rejeitar pedido?</h3>
              <p className="adm-modal-desc">
                Tem certeza que deseja <strong>rejeitar</strong> o pedido{" "}
                <strong>#{rejectModal.slice(-8).toUpperCase()}</strong>? O
                pedido será <strong>apagado permanentemente</strong> do banco.
              </p>
              {rejectError && (
                <div className="adm-modal-error">⚠️ {rejectError}</div>
              )}
              <div className="adm-modal-actions">
                <button
                  className="adm-modal-btn-back"
                  onClick={closeRejectModal}
                  disabled={rejecting}
                >
                  Cancelar
                </button>
                <button
                  className="adm-modal-btn-reject"
                  onClick={confirmReject}
                  disabled={rejecting}
                >
                  {rejecting ? "Rejeitando..." : "Sim, rejeitar"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* HEADER */}
        <header className="adm-header">
          <div className="adm-header-left">
            <div className="adm-logo">
              <span className="adm-logo-dudu">Dudu</span>
              <span className="adm-logo-bebidas">Bebidas</span>
            </div>
            <div className="adm-badge">ADMIN</div>
          </div>
          <div className="adm-header-right">
            <span className="adm-admin-email">👤 {user.email}</span>
            <button className="adm-btn-back" onClick={() => navigate("/")}>
              ← Voltar à loja
            </button>
          </div>
        </header>

        {/* TÍTULO */}
        <div className="adm-title-row">
          <div>
            <h1 className="adm-title">Painel de Pedidos</h1>
            <p className="adm-subtitle">
              {totalCount} pedido(s) no total · mostrando {orders.length} ·
              atualiza em tempo real
            </p>
          </div>
          <div
            className="adm-realtime-dot"
            aria-label="Atualização em tempo real"
          >
            <span className="adm-dot-pulse" />
            <span>Ao vivo</span>
          </div>
        </div>

        {/* MÉTRICAS */}
        <div className="adm-today-metrics">
          <div className="adm-metric-card">
            <div className="adm-metric-icon">📅</div>
            <div className="adm-metric-content">
              <span className="adm-metric-value">{metrics.count}</span>
              <span className="adm-metric-label">Pedidos hoje</span>
            </div>
          </div>
          <div className="adm-metric-card">
            <div className="adm-metric-icon">💰</div>
            <div className="adm-metric-content">
              <span className="adm-metric-value">
                {formatBRL(metrics.total)}
              </span>
              <span className="adm-metric-label">Vendas hoje</span>
            </div>
          </div>
        </div>

        {/* FILTROS */}
        <div className="adm-stats" role="group" aria-label="Filtrar por status">
          {[
            { key: "all", icon: null, num: counts.all, label: "Total" },
            {
              key: "pending",
              icon: "🕐",
              num: counts.pending,
              label: "Aguardando",
            },
            {
              key: "preparing",
              icon: "👨‍🍳",
              num: counts.preparing,
              label: "Preparando",
            },
            {
              key: "on_the_way",
              icon: "🛵",
              num: counts.on_the_way,
              label: "Em entrega",
            },
            {
              key: "delivered",
              icon: "✅",
              num: counts.delivered,
              label: "Entregue",
            },
          ].map(({ key, icon, num, label }) => (
            <button
              key={key}
              className={`adm-stat adm-stat-${key} ${filterStatus === key ? "adm-stat-active" : ""}`}
              onClick={() => setFilterStatus(key)}
              aria-pressed={filterStatus === key}
            >
              {icon && <span className="adm-stat-icon">{icon}</span>}
              <span className="adm-stat-num">{num}</span>
              <span className="adm-stat-label">{label}</span>
            </button>
          ))}
        </div>

        {/* LISTA */}
        {loading ? (
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
                          setExpandedId((p) =>
                            p === order.id ? null : order.id,
                          )
                        }
                        onAccept={() => advanceStatus(order)}
                        onReject={() => setRejectModal(order.id)}
                        onAdvance={() => advanceStatus(order)}
                        onSetStatus={(s) => setStatus(order.id, s)}
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
                    `Carregar mais pedidos (${orders.length} de ${totalCount})`
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
      </div>
    </div>
  );
}

// ── Card de pedido ────────────────────────────────────
function OrderCard({
  order,
  isExpanded,
  isUpdating,
  onToggle,
  onAccept,
  onReject,
  onAdvance,
  onSetStatus,
}) {
  const pickup = isPickup(order);
  const cfg = getConfig(order);
  const nextSt = getNext(order);
  const statuses = getStatuses(order);
  const isPending = order.status === "pending";
  const payment = PAYMENT_LABEL[order.payment_method] ?? {
    icon: "💳",
    label: order.payment_method,
  };
  const shortId = order.id.slice(-8).toUpperCase();

  return (
    <li className={`adm-order adm-order-${order.status}`}>
      {/* LINHA PRINCIPAL */}
      <div
        className="adm-order-main"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onToggle()}
      >
        <div className="adm-order-status">
          <span className="adm-status-icon">{cfg.icon}</span>
          <span className="adm-status-label" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
          {pickup && <span className="adm-retirada-badge">🏪 RETIRADA</span>}
        </div>

        <div className="adm-order-info">
          <span className="adm-order-id">#{shortId}</span>
          <span className="adm-order-name">{order.address?.name ?? "—"}</span>
          {pickup ? (
            <span className="adm-order-retirada-info">🏪 Retirada na loja</span>
          ) : (
            <span className="adm-order-district">
              📍 {order.address?.district ?? "—"}
            </span>
          )}
        </div>

        <div className="adm-order-payment">
          <span>
            {payment.icon} {payment.label}
          </span>
          <span className="adm-order-total">{formatBRL(order.total)}</span>
        </div>

        {isPending && (
          <div
            className="adm-order-actions"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="adm-btn-accept"
              onClick={onAccept}
              disabled={isUpdating}
              title={pickup ? "Confirmar retirada" : "Aceitar pedido"}
            >
              {isUpdating ? "..." : `✓ ${pickup ? "Confirmar" : "Aceitar"}`}
            </button>
            <button
              className="adm-btn-reject"
              onClick={onReject}
              disabled={isUpdating}
            >
              ✕ Rejeitar
            </button>
          </div>
        )}

        <span className="adm-order-date">{formatDate(order.created_at)}</span>
        <span
          className={`adm-chevron ${isExpanded ? "open" : ""}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </div>

      {/* DETALHES EXPANDIDOS */}
      {isExpanded && (
        <div
          className={`adm-order-detail adm-order-detail--${pickup ? "pickup" : "delivery"}`}
        >
          <div className="adm-detail-section">
            <div className="adm-detail-label">🛒 Itens</div>
            <div className="adm-items">
              {(order.order_items ?? []).map((item) => (
                <div className="adm-item" key={item.id}>
                  <span className="adm-item-name">{item.name}</span>
                  <span className="adm-item-qty">x{item.quantity}</span>
                  <span className="adm-item-price">
                    {formatBRL(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="adm-detail-section">
            <div className="adm-detail-label">
              {pickup ? "🏪 Informações da Retirada" : "📍 Endereço"}
            </div>
            <div className="adm-address">
              <p>
                <strong>{order.address?.name}</strong>
              </p>
              {pickup ? (
                <>
                  <p>🏪 Retirada na loja</p>
                  <p>📍 Rua Edgar Torres, 650 — Belo Horizonte/MG</p>
                </>
              ) : (
                <>
                  <p>
                    {order.address?.street}, {order.address?.number}
                    {order.address?.complement
                      ? ` — ${order.address.complement}`
                      : ""}
                  </p>
                  <p>{order.address?.district}</p>
                </>
              )}
              <p>📞 {order.address?.phone}</p>
            </div>
          </div>

          <div className="adm-detail-section">
            <div className="adm-detail-label">
              {pickup ? "🔄 Status da Retirada" : "🔄 Alterar Status"}
            </div>
            {isPending ? (
              <div className="adm-accept-reject-detail">
                <button
                  className="adm-btn-accept-lg"
                  onClick={onAccept}
                  disabled={isUpdating}
                >
                  {isUpdating
                    ? "Processando..."
                    : `✓ ${pickup ? "Confirmar Retirada" : "Aceitar Pedido"}`}
                </button>
                <button
                  className="adm-btn-reject-lg"
                  onClick={onReject}
                  disabled={isUpdating}
                >
                  ✕ Rejeitar Pedido
                </button>
              </div>
            ) : (
              <>
                <div className="adm-status-pills">
                  {statuses.map((s) => {
                    const map = pickup ? STATUS_PICKUP : STATUS_DELIVERY;
                    return (
                      <button
                        key={s}
                        className={`adm-pill ${order.status === s ? "adm-pill-active" : ""}`}
                        style={{ "--pill-color": map[s]?.color }}
                        onClick={() => onSetStatus(s)}
                        disabled={isUpdating}
                      >
                        {map[s]?.icon} {map[s]?.label}
                      </button>
                    );
                  })}
                </div>
                {nextSt ? (
                  <button
                    className="adm-btn-advance"
                    onClick={onAdvance}
                    disabled={isUpdating}
                  >
                    {isUpdating
                      ? "Atualizando..."
                      : (() => {
                          const map = pickup ? STATUS_PICKUP : STATUS_DELIVERY;
                          return `Avançar para: ${map[nextSt]?.icon} ${map[nextSt]?.label} →`;
                        })()}
                  </button>
                ) : (
                  <div className="adm-delivered-msg">
                    {pickup ? "✅ Retirada finalizada" : "✅ Pedido finalizado"}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </li>
  );
}