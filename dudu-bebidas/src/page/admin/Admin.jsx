import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase/Supabaseclient";
import "./Admin.css";

// ── Status config ─────────────────────────────────────
const STATUS_CONFIG = {
  pending:    { label: "Aguardando",  icon: "🕐", color: "#ffd000", next: "preparing"  },
  preparing:  { label: "Preparando",  icon: "👨‍🍳", color: "#ff8c00", next: "on_the_way" },
  on_the_way: { label: "Em entrega",  icon: "🛵", color: "#50c878", next: "delivered"  },
  delivered:  { label: "Entregue",    icon: "✅", color: "#aaa",    next: null         },
};

const PAYMENT_LABEL = {
  pix:  { icon: "⚡", label: "PIX"      },
  card: { icon: "💳", label: "Cartão"   },
  cash: { icon: "💵", label: "Dinheiro" },
};

const STATUS_ORDER = ["pending", "preparing", "on_the_way", "delivered"];
const PAGE_SIZE    = 20;

export default function Admin({ user, isAdmin }) {
  const navigate = useNavigate();

  const [orders, setOrders]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [hasMore, setHasMore]           = useState(true);
  const [page, setPage]                 = useState(0);
  const [totalCount, setTotalCount]     = useState(0);
  const [updating, setUpdating]         = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedId, setExpandedId]     = useState(null);

  const [todayOrdersCount, setTodayOrdersCount] = useState(0);
  const [todaySalesTotal, setTodaySalesTotal]   = useState(0);

  // ── Modal de rejeição ─────────────────────────────
  const [rejectModal, setRejectModal]     = useState(null); // orderId
  const [rejecting, setRejecting]         = useState(false);
  const [rejectError, setRejectError]     = useState("");

  // ── Métricas do dia ───────────────────────────────
  const fetchTodayMetrics = async () => {
    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const { data, error, count } = await supabase
      .from("orders")
      .select("total", { count: "exact" })
      .gte("created_at", today.toISOString())
      .lt("created_at", tomorrow.toISOString());

    if (!error && data) {
      setTodayOrdersCount(count || 0);
      setTodaySalesTotal(data.reduce((sum, o) => sum + (o.total || 0), 0));
    }
  };

  // ── Busca pedidos + Realtime ──────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    fetchOrders(0, true);
    fetchTodayMetrics();

    const channel = supabase
      .channel("admin-orders")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => { fetchOrders(0, true); fetchTodayMetrics(); }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [isAdmin]);

  // ── Reset paginação ao mudar filtro ──────────────
  useEffect(() => {
    if (!isAdmin) return;
    setPage(0); setOrders([]); setHasMore(true);
    fetchOrders(0, true);
  }, [filterStatus]);

  // ── Fetch com paginação ───────────────────────────
  const fetchOrders = async (pageNum = 0, reset = false) => {
    if (pageNum === 0) setLoading(true);
    else setLoadingMore(true);

    const from = pageNum * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;

    let query = supabase
      .from("orders")
      .select(`
        id, total, payment_method, address, status, created_at,
        order_items ( id, name, price, quantity )
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filterStatus !== "all") query = query.eq("status", filterStatus);

    const { data, error, count } = await query;

    if (!error) {
      const newOrders = data ?? [];
      setOrders((prev) => reset || pageNum === 0 ? newOrders : [...prev, ...newOrders]);
      setHasMore(newOrders.length === PAGE_SIZE);
      if (count !== null) setTotalCount(count);
    }

    setLoading(false);
    setLoadingMore(false);
  };

  // ── Carregar mais ─────────────────────────────────
  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchOrders(next);
  };

  // ── Aceitar pedido → avança para "preparing" ─────
  const handleAcceptOrder = async (orderId) => {
    setUpdating(orderId);
    await supabase
      .from("orders")
      .update({ status: "preparing" })
      .eq("id", orderId);
    setUpdating(null);
  };

  // ── Rejeitar pedido → deleta do banco ────────────
  const handleRejectOrder = async () => {
    if (!rejectModal) return;
    setRejecting(true);
    setRejectError("");

    try {
      const { error: itemsError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", rejectModal);

      if (itemsError) throw new Error("Erro ao remover itens do pedido.");

      const { error: orderError } = await supabase
        .from("orders")
        .delete()
        .eq("id", rejectModal);

      if (orderError) throw new Error("Erro ao rejeitar o pedido.");

      setRejectModal(null);
      setRejecting(false);

    } catch (err) {
      setRejectError(err.message);
      setRejecting(false);
    }
  };

  // ── Handlers de status ────────────────────────────
  const handleAdvanceStatus = async (orderId, currentStatus) => {
    const nextStatus = STATUS_CONFIG[currentStatus]?.next;
    if (!nextStatus) return;
    setUpdating(orderId);
    await supabase.from("orders").update({ status: nextStatus }).eq("id", orderId);
    setUpdating(null);
  };

  const handleSetStatus = async (orderId, newStatus) => {
    setUpdating(orderId);
    await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
    setUpdating(null);
  };

  const counts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = orders.filter((o) => o.status === s).length;
    return acc;
  }, {});

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const formatCurrency = (value) =>
    `R$ ${value.toFixed(2).replace(".", ",")}`;

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

  return (
    <div className="adm-root">
      <div className="adm-wrap">

        {/* ── MODAL DE REJEIÇÃO ── */}
        {rejectModal && (
          <>
            <div
              className="adm-modal-overlay"
              onClick={() => !rejecting && setRejectModal(null)}
            />
            <div className="adm-modal">
              <div className="adm-modal-icon">🚫</div>
              <h3 className="adm-modal-title">Rejeitar pedido?</h3>
              <p className="adm-modal-desc">
                Tem certeza que deseja <strong>rejeitar</strong> o pedido{" "}
                <strong>#{rejectModal.slice(-8).toUpperCase()}</strong>?
                O pedido será <strong>apagado permanentemente</strong> do banco.
              </p>

              {rejectError && (
                <div className="adm-modal-error">⚠️ {rejectError}</div>
              )}

              <div className="adm-modal-actions">
                <button
                  className="adm-modal-btn-back"
                  onClick={() => { setRejectModal(null); setRejectError(""); }}
                  disabled={rejecting}
                >
                  Cancelar
                </button>
                <button
                  className="adm-modal-btn-reject"
                  onClick={handleRejectOrder}
                  disabled={rejecting}
                >
                  {rejecting ? "Rejeitando..." : "Sim, rejeitar"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── HEADER ── */}
        <div className="adm-header">
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
        </div>

        {/* ── TÍTULO ── */}
        <div className="adm-title-row">
          <div>
            <h1 className="adm-title">Painel de Pedidos</h1>
            <p className="adm-subtitle">
              {totalCount} pedido(s) no total · mostrando {orders.length} · atualiza em tempo real
            </p>
          </div>
          <div className="adm-realtime-dot">
            <span className="adm-dot-pulse" />
            <span>Ao vivo</span>
          </div>
        </div>

        {/* ── MÉTRICAS DO DIA ── */}
        <div className="adm-today-metrics">
          <div className="adm-metric-card">
            <div className="adm-metric-icon">📅</div>
            <div className="adm-metric-content">
              <span className="adm-metric-value">{todayOrdersCount}</span>
              <span className="adm-metric-label">Pedidos hoje</span>
            </div>
          </div>
          <div className="adm-metric-card">
            <div className="adm-metric-icon">💰</div>
            <div className="adm-metric-content">
              <span className="adm-metric-value">{formatCurrency(todaySalesTotal)}</span>
              <span className="adm-metric-label">Vendas hoje</span>
            </div>
          </div>
        </div>

        {/* ── CARDS DE RESUMO ── */}
        <div className="adm-stats">
          <div
            className={`adm-stat adm-stat-all ${filterStatus === "all" ? "adm-stat-active" : ""}`}
            onClick={() => setFilterStatus("all")}
          >
            <span className="adm-stat-num">{totalCount}</span>
            <span className="adm-stat-label">Total</span>
          </div>
          {STATUS_ORDER.map((s) => (
            <div
              key={s}
              className={`adm-stat adm-stat-${s} ${filterStatus === s ? "adm-stat-active" : ""}`}
              onClick={() => setFilterStatus(s)}
            >
              <span className="adm-stat-icon">{STATUS_CONFIG[s].icon}</span>
              <span className="adm-stat-num">{counts[s]}</span>
              <span className="adm-stat-label">{STATUS_CONFIG[s].label}</span>
            </div>
          ))}
        </div>

        {/* ── FILTROS ── */}
        <div className="adm-filters">
          <button
            className={`adm-filter-btn ${filterStatus === "all" ? "active" : ""}`}
            onClick={() => setFilterStatus("all")}
          >
            Todos ({totalCount})
          </button>
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              className={`adm-filter-btn ${filterStatus === s ? "active" : ""}`}
              onClick={() => setFilterStatus(s)}
              style={{ "--btn-color": STATUS_CONFIG[s].color }}
            >
              {STATUS_CONFIG[s].icon} {STATUS_CONFIG[s].label} ({counts[s]})
            </button>
          ))}
        </div>

        {/* ── LISTA DE PEDIDOS ── */}
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
            <div className="adm-orders">
              {orders.map((order) => {
                const cfg        = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
                const payment    = PAYMENT_LABEL[order.payment_method] ?? { icon: "💳", label: order.payment_method };
                const isExpanded = expandedId === order.id;
                const isUpdating = updating === order.id;
                const shortId    = order.id.slice(-8).toUpperCase();
                const isPending  = order.status === "pending";

                return (
                  <div key={order.id} className={`adm-order adm-order-${order.status}`}>

                    {/* ── LINHA PRINCIPAL ── */}
                    <div
                      className="adm-order-main"
                      onClick={() => setExpandedId(isExpanded ? null : order.id)}
                    >
                      <div className="adm-order-status">
                        <span className="adm-status-icon">{cfg.icon}</span>
                        <span className="adm-status-label" style={{ color: cfg.color }}>
                          {cfg.label}
                        </span>
                      </div>

                      <div className="adm-order-info">
                        <span className="adm-order-id">#{shortId}</span>
                        <span className="adm-order-name">{order.address?.name ?? "—"}</span>
                        <span className="adm-order-district">📍 {order.address?.district ?? "—"}</span>
                      </div>

                      <div className="adm-order-payment">
                        <span>{payment.icon} {payment.label}</span>
                        <span className="adm-order-total">
                          R$ {Number(order.total).toFixed(2).replace(".", ",")}
                        </span>
                      </div>

                      {/* ── BOTÕES ACEITAR / REJEITAR (só para pending) ── */}
                      {isPending && (
                        <div
                          className="adm-order-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            className="adm-btn-accept"
                            onClick={() => handleAcceptOrder(order.id)}
                            disabled={isUpdating}
                            title="Aceitar pedido"
                          >
                            {isUpdating ? "..." : "✓ Aceitar"}
                          </button>
                          <button
                            className="adm-btn-reject"
                            onClick={() => setRejectModal(order.id)}
                            disabled={isUpdating}
                            title="Rejeitar pedido"
                          >
                            ✕ Rejeitar
                          </button>
                        </div>
                      )}

                      <span className="adm-order-date">{formatDate(order.created_at)}</span>
                      <span className={`adm-chevron ${isExpanded ? "open" : ""}`}>▾</span>
                    </div>

                    {/* ── DETALHES EXPANDIDOS ── */}
                    {isExpanded && (
                      <div className="adm-order-detail">

                        <div className="adm-detail-section">
                          <div className="adm-detail-label">🛒 Itens</div>
                          <div className="adm-items">
                            {(order.order_items ?? []).map((item) => (
                              <div className="adm-item" key={item.id}>
                                <span className="adm-item-name">{item.name}</span>
                                <span className="adm-item-qty">x{item.quantity}</span>
                                <span className="adm-item-price">
                                  R$ {(item.price * item.quantity).toFixed(2).replace(".", ",")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="adm-detail-section">
                          <div className="adm-detail-label">📍 Endereço</div>
                          <div className="adm-address">
                            <p><strong>{order.address?.name}</strong></p>
                            <p>
                              {order.address?.street}, {order.address?.number}
                              {order.address?.complement ? ` — ${order.address.complement}` : ""}
                            </p>
                            <p>{order.address?.district}</p>
                            <p>📞 {order.address?.phone}</p>
                          </div>
                        </div>

                        <div className="adm-detail-section">
                          <div className="adm-detail-label">🔄 Alterar Status</div>

                          {/* Aceitar/Rejeitar também nos detalhes expandidos para pending */}
                          {isPending && (
                            <div className="adm-accept-reject-detail">
                              <button
                                className="adm-btn-accept-lg"
                                onClick={() => handleAcceptOrder(order.id)}
                                disabled={isUpdating}
                              >
                                {isUpdating ? "Processando..." : "✓ Aceitar Pedido"}
                              </button>
                              <button
                                className="adm-btn-reject-lg"
                                onClick={() => setRejectModal(order.id)}
                                disabled={isUpdating}
                              >
                                ✕ Rejeitar Pedido
                              </button>
                            </div>
                          )}

                          {!isPending && (
                            <>
                              <div className="adm-status-pills">
                                {STATUS_ORDER.map((s) => (
                                  <button
                                    key={s}
                                    className={`adm-pill ${order.status === s ? "adm-pill-active" : ""}`}
                                    style={{ "--pill-color": STATUS_CONFIG[s].color }}
                                    onClick={() => handleSetStatus(order.id, s)}
                                    disabled={isUpdating}
                                  >
                                    {STATUS_CONFIG[s].icon} {STATUS_CONFIG[s].label}
                                  </button>
                                ))}
                              </div>

                              {cfg.next && (
                                <button
                                  className="adm-btn-advance"
                                  onClick={() => handleAdvanceStatus(order.id, order.status)}
                                  disabled={isUpdating}
                                >
                                  {isUpdating
                                    ? "Atualizando..."
                                    : `Avançar para: ${STATUS_CONFIG[cfg.next].icon} ${STATUS_CONFIG[cfg.next].label} →`}
                                </button>
                              )}

                              {!cfg.next && (
                                <div className="adm-delivered-msg">✅ Pedido finalizado</div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {hasMore && (
              <div className="adm-load-more-wrap">
                <button
                  className="adm-load-more"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <><div className="adm-spinner-sm" /> Carregando...</>
                  ) : (
                    `Carregar mais pedidos (${orders.length} de ${totalCount})`
                  )}
                </button>
              </div>
            )}

            {!hasMore && orders.length > PAGE_SIZE && (
              <div className="adm-end-msg">✓ Todos os {totalCount} pedidos carregados</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}