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

export default function Admin({ user }) {
  const navigate = useNavigate();

  const [isAdmin, setIsAdmin]           = useState(null); // null = verificando
  const [orders, setOrders]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [updating, setUpdating]         = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedId, setExpandedId]     = useState(null);

  // ── Verifica is_admin no banco ────────────────────
  useEffect(() => {
    if (user === null) return; // ainda carregando
    if (!user) { navigate("/"); return; }

    const checkAdmin = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (error || !data?.is_admin) {
        navigate("/");
        return;
      }

      setIsAdmin(true);
    };

    checkAdmin();
  }, [user]);

  // ── Busca pedidos + Realtime ──────────────────────
  useEffect(() => {
    if (!isAdmin) return;

    fetchOrders();

    const channel = supabase
      .channel("admin-orders")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => fetchOrders()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [isAdmin]);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id, total, payment_method, address, status, created_at,
        order_items ( id, name, price, quantity )
      `)
      .order("created_at", { ascending: false });

    if (!error) setOrders(data ?? []);
    setLoading(false);
  };

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

  const filtered = filterStatus === "all"
    ? orders
    : orders.filter((o) => o.status === filterStatus);

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

  // ── Tela de verificação ───────────────────────────
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
            <p className="adm-subtitle">{orders.length} pedido(s) no total · atualiza em tempo real</p>
          </div>
          <div className="adm-realtime-dot">
            <span className="adm-dot-pulse" />
            <span>Ao vivo</span>
          </div>
        </div>

        {/* ── CARDS DE RESUMO ── */}
        <div className="adm-stats">
          <div
            className={`adm-stat adm-stat-all ${filterStatus === "all" ? "adm-stat-active" : ""}`}
            onClick={() => setFilterStatus("all")}
          >
            <span className="adm-stat-num">{orders.length}</span>
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
            Todos ({orders.length})
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
        ) : filtered.length === 0 ? (
          <div className="adm-empty">
            <p>Nenhum pedido encontrado.</p>
          </div>
        ) : (
          <div className="adm-orders">
            {filtered.map((order) => {
              const cfg        = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
              const payment    = PAYMENT_LABEL[order.payment_method] ?? { icon: "💳", label: order.payment_method };
              const isExpanded = expandedId === order.id;
              const isUpdating = updating === order.id;
              const shortId    = order.id.slice(-8).toUpperCase();

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
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}