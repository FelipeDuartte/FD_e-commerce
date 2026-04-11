import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../supabase/Supabaseclient";
import "./Confirm.css";

const paymentLabels = {
  pix:  { icon: "⚡", label: "PIX" },
  card: { icon: "💳", label: "Cartão" },
  cash: { icon: "💵", label: "Dinheiro" },
};

const STATUS_STEP = {
  pending:    0,
  preparing:  1,
  on_the_way: 2,
  delivered:  3,
};

const STEPS = [
  {
    icon: "✅",
    title: "Pedido confirmado",
    desc: "Recebemos seu pedido",
    activeDesc: "Seu pedido foi registrado com sucesso!",
  },
  {
    icon: "👨‍🍳",
    title: "Em preparação",
    desc: "Separando seus produtos",
    activeDesc: "Estamos preparando tudo com cuidado para você.",
  },
  {
    icon: "🛵",
    title: "Saiu para entrega",
    desc: "A caminho do seu endereço",
    activeDesc: "Seu pedido está a caminho! Fique de olho.",
  },
  {
    icon: "🎉",
    title: "Entregue",
    desc: "Pedido finalizado",
    activeDesc: "Pedido entregue. Bom proveito! 🍺",
  },
];

export default function Confirmacao() {
  const location = useLocation();
  const navigate  = useNavigate();

  const [orderData] = useState(() => {
    if (location.state && location.state.pedido) return location.state;
    const savedOrder = localStorage.getItem("lastOrder");
    if (savedOrder) {
      try { return JSON.parse(savedOrder); } catch (e) { console.error(e); }
    }
    return { orderId: null, cartItems: [], total: 0, payment: "pix", address: {}, isRetirada: false };
  });

  const [status, setStatus]           = useState("pending");
  const [statusLoading, setStatusLoading] = useState(true);
  const [animating, setAnimating]     = useState(false);

  // ── Cancelamento ──────────────────────────────────
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling]           = useState(false);
  const [cancelError, setCancelError]         = useState("");

  const {
    orderId    = orderData.orderId    || null,
    cartItems  = orderData.cartItems  || [],
    total      = orderData.total      || 0,
    payment    = orderData.payment    || "pix",
    address    = orderData.address    || {},
    isRetirada = orderData.isRetirada || false,
  } = location.state?.pedido || orderData;

  useEffect(() => {
    if (location.state?.pedido || (orderId && cartItems.length > 0)) {
      localStorage.setItem("lastOrder", JSON.stringify({
        orderId, cartItems, total, payment, address, isRetirada,
        savedAt: new Date().toISOString(),
      }));
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId) { setStatusLoading(false); return; }

    const fetchStatus = async () => {
      const { data, error } = await supabase
        .from("orders").select("status").eq("id", orderId).single();
      if (!error && data?.status) setStatus(data.status);
      setStatusLoading(false);
    };

    fetchStatus();

    const channel = supabase
      .channel(`order-status-${orderId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => {
          if (payload.new?.status) {
            setAnimating(true);
            setStatus(payload.new.status);
            setTimeout(() => setAnimating(false), 600);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [orderId]);

  // ── Handler de cancelamento ───────────────────────
  const handleCancelOrder = async () => {
    setCancelling(true);
    setCancelError("");

    try {
      // 1. Deleta os itens do pedido primeiro (FK)
      const { error: itemsError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", orderId);

      if (itemsError) throw new Error("Erro ao cancelar itens do pedido.");

      // 2. Deleta o pedido
      const { error: orderError } = await supabase
        .from("orders")
        .delete()
        .eq("id", orderId);

      if (orderError) throw new Error("Erro ao cancelar o pedido.");

      // 3. Limpa o localStorage
      localStorage.removeItem("lastOrder");

      // 4. Redireciona para home com mensagem
      navigate("/", { state: { cancelledOrder: true } });

    } catch (err) {
      setCancelError(err.message);
      setCancelling(false);
    }
  };

  const currentStep = STATUS_STEP[status] ?? 0;
  const canCancel   = status === "pending" && orderId && !isRetirada;

  // ── Sem orderId e sem itens ───────────────────────
  if (!orderId && cartItems.length === 0) {
    return (
      <div className="cf-root">
        <div className="cf-wrap cf-center">
          <div className="cf-card" style={{ textAlign: "center", maxWidth: 400 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📦</div>
            <h2 style={{ marginBottom: 8 }}>Nenhum pedido encontrado</h2>
            <p style={{ color: "#666", marginBottom: 24 }}>Não encontramos informações do seu pedido.</p>
            <button className="cf-btn-home" onClick={() => navigate("/")}>Voltar para a loja</button>
          </div>
        </div>
      </div>
    );
  }

  const paymentInfo = paymentLabels[payment] ?? { icon: "💳", label: payment };
  const shortId     = orderId ? orderId.slice(-8).toUpperCase() : "RETIRADA";

  return (
    <div className="cf-root">
      <div className="cf-particle cf-p1" />
      <div className="cf-particle cf-p2" />
      <div className="cf-particle cf-p3" />

      {/* ── MODAL DE CONFIRMAÇÃO DE CANCELAMENTO ── */}
      {showCancelModal && (
        <>
          <div className="cf-modal-overlay" onClick={() => !cancelling && setShowCancelModal(false)} />
          <div className="cf-modal">
            <div className="cf-modal-icon">⚠️</div>
            <h3 className="cf-modal-title">Cancelar pedido?</h3>
            <p className="cf-modal-desc">
              Tem certeza que deseja cancelar o pedido <strong>#{shortId}</strong>?
              Esta ação não pode ser desfeita.
            </p>

            {cancelError && (
              <div className="cf-modal-error">⚠️ {cancelError}</div>
            )}

            <div className="cf-modal-actions">
              <button
                className="cf-modal-btn-cancel"
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
              >
                Voltar
              </button>
              <button
                className="cf-modal-btn-confirm"
                onClick={handleCancelOrder}
                disabled={cancelling}
              >
                {cancelling ? "Cancelando..." : "Sim, cancelar pedido"}
              </button>
            </div>
          </div>
        </>
      )}

      <div className="cf-wrap">

        {/* ── HERO ── */}
        <div className="cf-hero">
          <div className="cf-check-ring">
            <div className="cf-check-circle">
              <svg viewBox="0 0 52 52" className="cf-checkmark">
                <circle cx="26" cy="26" r="25" fill="none" />
                <path fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
              </svg>
            </div>
          </div>
          <div className="cf-hero-text">
            <div className="cf-tag">PEDIDO CONFIRMADO</div>
            <h1 className="cf-title">Pedido recebido!</h1>
            <p className="cf-subtitle">
              Seu pedido foi registrado com sucesso e já está sendo preparado.
            </p>
          </div>
          <div className="cf-order-id">
            <span className="cf-order-id-label">Nº DO PEDIDO</span>
            <span className="cf-order-id-value">#{shortId}</span>
          </div>
        </div>

        {/* ── TRACKER ── */}
        <div className="cf-tracker-card">
          <div className="cf-tracker-header">
            <span className="cf-tracker-label">📦 Acompanhe seu pedido</span>
            {!statusLoading && (
              <span className={`cf-status-badge cf-status-${status}`}>
                {STEPS[currentStep].icon} {STEPS[currentStep].title}
              </span>
            )}
          </div>

          {statusLoading ? (
            <div className="cf-tracker-loading">
              <div className="cf-loading-bar" />
              <p>Carregando status...</p>
            </div>
          ) : (
            <>
              <div className="cf-progress-track">
                <div className="cf-progress-fill" style={{ width: `${(currentStep / 3) * 100}%` }} />
              </div>

              <div className="cf-steps">
                {STEPS.map((step, i) => {
                  const isDone    = i < currentStep;
                  const isActive  = i === currentStep;
                  const isPending = i > currentStep;
                  return (
                    <div
                      key={i}
                      className={`cf-step ${isDone ? "cf-step-done" : ""} ${isActive ? "cf-step-active" : ""} ${isPending ? "cf-step-pending" : ""} ${animating && i === currentStep ? "cf-step-entering" : ""}`}
                    >
                      <div className="cf-step-icon-wrap">
                        <div className="cf-step-icon">{isDone ? "✓" : step.icon}</div>
                        {isActive && <div className="cf-step-pulse" />}
                      </div>
                      <div className="cf-step-info">
                        <span className="cf-step-title">{step.title}</span>
                        <span className="cf-step-desc">{isActive ? step.activeDesc : step.desc}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={`cf-status-msg cf-status-msg-${status}`}>
                <span className="cf-status-msg-icon">{STEPS[currentStep].icon}</span>
                <span className="cf-status-msg-text">{STEPS[currentStep].activeDesc}</span>
              </div>
            </>
          )}
        </div>

        {/* ── GRID ── */}
        <div className="cf-grid">

          {/* COLUNA ESQUERDA */}
          <div className="cf-col">
            <div className="cf-card">
              <div className="cf-card-label">🛒 Itens do Pedido</div>
              <div className="cf-items">
                {cartItems.map((item, i) => (
                  <div className="cf-item" key={i}>
                    <div className="cf-item-img">
                      {item.imagem || item.icon
                        ? <img src={item.imagem || item.icon} alt={item.nome || item.name} />
                        : "🍺"}
                    </div>
                    <div className="cf-item-info">
                      <span className="cf-item-name">{item.nome || item.name}</span>
                      <span className="cf-item-qty">{item.quantity} unidade(s)</span>
                    </div>
                    <span className="cf-item-price">
                      R$ {((item.preco || item.price) * item.quantity).toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                ))}
              </div>
              <div className="cf-total-row">
                <span>Total pago</span>
                <span className="cf-total-value">R$ {total.toFixed(2).replace(".", ",")}</span>
              </div>
            </div>

            {!isRetirada && address?.name && (
              <div className="cf-card">
                <div className="cf-card-label">📍 Endereço de Entrega</div>
                <div className="cf-address">
                  <p className="cf-address-name">{address.name}</p>
                  <p>{address.street}, {address.number}{address.complement ? ` — ${address.complement}` : ""}</p>
                  <p>{address.district}</p>
                  <p className="cf-address-phone">📞 {address.phone}</p>
                </div>
              </div>
            )}
          </div>

          {/* COLUNA DIREITA */}
          <div className="cf-col">
            <div className="cf-card cf-card-payment">
              <div className="cf-card-label">💳 Forma de Pagamento</div>
              <div className="cf-payment">
                <span className="cf-payment-icon">{paymentInfo.icon}</span>
                <span className="cf-payment-label">{paymentInfo.label}</span>
              </div>
            </div>

            <button className="cf-btn-home" onClick={() => navigate("/")}>
              🏠 Voltar para a loja
            </button>

            {/* ── BOTÃO CANCELAR — só aparece se status for pending ── */}
            {canCancel && (
              <button
                className="cf-btn-cancel"
                onClick={() => setShowCancelModal(true)}
              >
                ✕ Cancelar pedido
              </button>
            )}

            {/* Aviso quando não pode mais cancelar */}
            {!canCancel && orderId && status !== "pending" && (
              <div className="cf-cancel-info">
                ℹ️ Não é mais possível cancelar — pedido já está em preparação.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}