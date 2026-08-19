import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { supabase, getCurrentStoreId } from "../../supabase/Supabaseclient";
import "./Confirm.css";
import { imgProduto } from "../../utils/Cloudnary";
import { PAYMENT_METHODS as PAYMENT_LABELS } from "../../utils/paymentMethods";

const STATUS_STEP = { pending: 0, preparing: 1, on_the_way: 2, delivered: 3 };

const STATUS_POLL_INTERVAL_MS = 5000;
const TERMINAL_STATUSES = ["rejected", "cancelled", "delivered"];

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

const EMPTY_ORDER = {
  orderId: null,
  cartItems: [],
  total: 0,
  payment: "pix",
  installments: null,
  address: {},
  isRetirada: false,
};

// ── Helper: lê order do location.state ou localStorage ──
function resolveOrderData(locationState) {
  if (locationState?.orderId || locationState?.cartItems) return locationState;
  if (locationState?.pedido) return locationState.pedido;

  const saved = localStorage.getItem("lastOrder");
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (error) {
      console.warn("Pedido salvo inválido.", error);
    }
  }
  return EMPTY_ORDER;
}

// ── Formatação de BRL ─────────────────────────────────
const formatBRL = (value) => `R$ ${Number(value).toFixed(2).replace(".", ",")}`;

// ══════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════
export default function Confirmacao() {
  const location = useLocation();
  const navigate = useNavigate();

  const [orderData] = useState(() => resolveOrderData(location.state));

  const { orderId, cartItems, total, payment, installments, address, isRetirada } = {
    ...EMPTY_ORDER,
    ...orderData,
  };

  const [status, setStatus] = useState("pending");
  const [statusLoading, setStatusLoading] = useState(true);
  const [animating, setAnimating] = useState(false);

  // ── Pagamento via Pix (chave da loja, confirmação manual) ──
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [customerClaimedPaidAt, setCustomerClaimedPaidAt] = useState(null);
  const [pixCharge, setPixCharge] = useState(null);
  const [pixQrImage, setPixQrImage] = useState(null);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixError, setPixError] = useState("");
  const [claimingPaid, setClaimingPaid] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Modal cancelamento ────────────────────────────
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  // ── Modal pedido rejeitado pelo admin ─────────────
  const [showRejectedModal, setShowRejectedModal] = useState(false);
  const [showCancelledModal, setShowCancelledModal] = useState(false);

  // ── Persiste no localStorage ──────────────────────
  useEffect(() => {
    if (orderId || cartItems.length > 0) {
      localStorage.setItem(
        "lastOrder",
        JSON.stringify({
          orderId,
          cartItems,
          total,
          payment,
          installments,
          address,
          isRetirada,
          savedAt: new Date().toISOString(),
        }),
      );
    }
  }, [orderId, cartItems, total, payment, installments, address, isRetirada]);

  // ── Status do pedido (polling via RPC) ─────────────
  // Antes era Realtime (postgres_changes), mas isso exige uma policy de
  // SELECT na tabela orders que qualquer anônimo pode explorar pra listar
  // todos os pedidos da loja (ver get_order_status). Sem essa policy, o
  // Realtime não consegue mais entregar updates pra esse cliente — então
  // aqui só reconsultamos o status por polling, que já usa a mesma RPC
  // segura (escopada por ID) da carga inicial.
  useEffect(() => {
    if (!orderId) {
      setStatusLoading(false);
      return;
    }

    let cancelled = false;
    let intervalId;
    let lastStatus = null;

    const applyStatus = (newStatus, { animate = false } = {}) => {
      if (newStatus === "rejected") {
        setStatus("rejected");
        setShowRejectedModal(true);
        localStorage.removeItem("lastOrder");
        return;
      }
      if (newStatus === "cancelled") {
        setStatus("cancelled");
        setShowCancelledModal(true);
        localStorage.removeItem("lastOrder");
        return;
      }
      if (animate) {
        setAnimating(true);
        setTimeout(() => setAnimating(false), 600);
      }
      setStatus(newStatus);
    };

    const fetchStatus = async () => {
      const { data, error } = await supabase.rpc("get_order_status", {
        p_order_id: orderId,
        p_store_id: getCurrentStoreId(),
      });
      if (cancelled) return;

      if (error) console.error("Erro ao buscar status:", error);

      if (!data?.success) {
        // Pedido não encontrado (fallback de segurança — hoje rejeição
        // não apaga mais a linha, mas mantido caso um pedido antigo
        // ainda tenha sido removido do jeito antigo).
        applyStatus("rejected");
        setStatusLoading(false);
        clearInterval(intervalId);
        return;
      }

      setPaymentStatus(data.payment_status ?? null);
      setCustomerClaimedPaidAt(data.customer_claimed_paid_at ?? null);

      const changed = lastStatus !== null && lastStatus !== data.status;
      lastStatus = data.status;
      applyStatus(data.status, { animate: changed });
      setStatusLoading(false);

      if (TERMINAL_STATUSES.includes(data.status)) {
        clearInterval(intervalId);
      }
    };

    fetchStatus();
    intervalId = setInterval(fetchStatus, STATUS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [orderId]);

  // ── Pix pendente: busca o QR/copia-e-cola quando aplicável ─
  const isPixPending = payment === "pix" && paymentStatus === "aguardando_pagamento";

  useEffect(() => {
    if (!orderId || !isPixPending || customerClaimedPaidAt || pixCharge || pixLoading) return;

    let cancelled = false;
    setPixLoading(true);
    setPixError("");

    supabase.functions
      .invoke("pix-charge", { body: { orderId, storeId: getCurrentStoreId() } })
      .then(async ({ data, error }) => {
        if (cancelled) return;
        if (error || data?.error) {
          setPixError(data?.error || "Não foi possível gerar o QR Code do Pix.");
          setPixLoading(false);
          return;
        }
        setPixCharge(data);
        try {
          const qrImage = await QRCode.toDataURL(data.brCode, { width: 260, margin: 1 });
          if (!cancelled) setPixQrImage(qrImage);
        } catch (e) {
          console.error("Erro ao gerar imagem do QR Code:", e);
        }
        if (!cancelled) setPixLoading(false);
      });

    return () => { cancelled = true; };
  }, [orderId, isPixPending, customerClaimedPaidAt, pixCharge, pixLoading]);

  const handleMarkPaid = async () => {
    setClaimingPaid(true);
    try {
      await supabase.rpc("mark_customer_claimed_paid", {
        p_order_id: orderId,
        p_store_id: getCurrentStoreId(),
      });
      setCustomerClaimedPaidAt(new Date().toISOString());
    } catch (e) {
      console.error("Erro ao registrar 'já paguei':", e);
    }
    setClaimingPaid(false);
  };

  const handleCopyPixCode = async () => {
    if (!pixCharge?.brCode) return;
    try {
      await navigator.clipboard.writeText(pixCharge.brCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Erro ao copiar código Pix:", e);
    }
  };

  // ── Cancelamento ──────────────────────────────────
  const handleCancelOrder = async () => {
    setCancelling(true);
    setCancelError("");

    try {
      if (!orderId) {
        localStorage.removeItem("lastOrder");
        navigate("/", { state: { cancelledOrder: true, isRetirada: true } });
        return;
      }

      // Usa RPC cancel_order (security definer) — não apaga mais o pedido,
      // só marca como "cancelled" e devolve o estoque (escopado à loja).
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "cancel_order",
        { p_order_id: orderId, p_store_id: getCurrentStoreId() },
      );

      if (rpcError || !rpcResult?.success)
        throw new Error(
          rpcError
            ? "Erro ao cancelar pedido."
            : (rpcResult?.error ?? "Erro ao cancelar pedido."),
        );

      localStorage.removeItem("lastOrder");
      navigate("/", { state: { cancelledOrder: true, isRetirada: false } });
    } catch (err) {
      setCancelError(err.message);
      setCancelling(false);
    }
  };

  // ── Guards ────────────────────────────────────────
  if (!orderId && cartItems.length === 0 && !isRetirada) {
    return (
      <div className="cf-root">
        <div className="cf-wrap cf-center">
          <div className="cf-card" style={{ maxWidth: 400 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📦</div>
            <h2 style={{ marginBottom: 8 }}>Nenhum pedido encontrado</h2>
            <p style={{ color: "#666", marginBottom: 24 }}>
              Não encontramos informações do seu pedido.
            </p>
            <button className="cf-btn-home" onClick={() => navigate("/")}>
              Voltar para a loja
            </button>
          </div>
        </div>
      </div>
    );
  }

  const paymentInfo = PAYMENT_LABELS[payment] ?? { icon: "💳", label: payment };
  const shortId = orderId ? orderId.slice(-8).toUpperCase() : "RETIRADA";
  const currentStep = STATUS_STEP[status] ?? 0;
  const canCancel = status === "pending" && (orderId || isRetirada);
  const entityLabel = isRetirada ? "retirada" : "pedido";

  return (
    <div className="cf-root">
      <div className="cf-particle cf-p1" />
      <div className="cf-particle cf-p2" />
      <div className="cf-particle cf-p3" />

      {/* MODAL — CANCELAR */}
      {showCancelModal && (
        <>
          <div
            className="cf-modal-overlay"
            onClick={() => !cancelling && setShowCancelModal(false)}
          />
          <div className="cf-modal">
            <div className="cf-modal-icon">⚠️</div>
            <h3 className="cf-modal-title">Cancelar {entityLabel}?</h3>
            <p className="cf-modal-desc">
              Tem certeza que deseja cancelar{" "}
              {isRetirada ? "a retirada" : "o pedido"}{" "}
              <strong>#{shortId}</strong>? Esta ação não pode ser desfeita.
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
                {cancelling ? "Cancelando..." : "Sim, cancelar"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* MODAL — PEDIDO REJEITADO PELO ADMIN */}
      {showRejectedModal && (
        <>
          <div className="cf-modal-overlay" />
          <div className="cf-modal" role="dialog" aria-modal="true">
            <div className="cf-modal-icon">😔</div>
            <h3 className="cf-modal-title">Pedido rejeitado</h3>
            <p className="cf-modal-desc">
              Infelizmente seu {entityLabel} <strong>#{shortId}</strong> foi{" "}
              <strong>rejeitado</strong> pela loja. Nenhum valor foi cobrado. Se
              tiver dúvidas, entre em contato com a loja.
            </p>
            <div className="cf-modal-actions">
              <button
                className="cf-modal-btn-confirm"
                onClick={() => navigate("/")}
              >
                Voltar para a loja
              </button>
            </div>
          </div>
        </>
      )}

      {/* MODAL — PEDIDO CANCELADO (pelo próprio cliente) */}
      {showCancelledModal && (
        <>
          <div className="cf-modal-overlay" />
          <div className="cf-modal" role="dialog" aria-modal="true">
            <div className="cf-modal-icon">🚫</div>
            <h3 className="cf-modal-title">Pedido cancelado</h3>
            <p className="cf-modal-desc">
              Seu {entityLabel} <strong>#{shortId}</strong> foi{" "}
              <strong>cancelado</strong>. Nenhum valor foi cobrado. Se foi um
              engano, é só fazer um novo pedido.
            </p>
            <div className="cf-modal-actions">
              <button
                className="cf-modal-btn-confirm"
                onClick={() => navigate("/")}
              >
                Voltar para a loja
              </button>
            </div>
          </div>
        </>
      )}

      <div className="cf-wrap">
        {/* HERO */}
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
            <div className="cf-tag">
              {isRetirada ? "RETIRADA CONFIRMADA" : "PEDIDO CONFIRMADO"}
            </div>
            <h1 className="cf-title">
              {isRetirada ? "Retirada agendada!" : "Pedido recebido!"}
            </h1>
            <p className="cf-subtitle">
              {isRetirada
                ? "Seu pedido já está separado. Passe na loja para retirar quando quiser."
                : "Seu pedido foi registrado com sucesso e já está sendo preparado."}
            </p>
          </div>
          <div className="cf-order-id">
            <span className="cf-order-id-label">
              {isRetirada ? "CÓDIGO DA RETIRADA" : "Nº DO PEDIDO"}
            </span>
            <span className="cf-order-id-value">#{shortId}</span>
          </div>
        </div>

        {/* PIX PENDENTE — substitui o tracker/retirada até confirmação */}
        {isPixPending && (
          <div className="cf-tracker-card">
            <div className="cf-tracker-header">
              <span className="cf-tracker-label">⚡ Pagamento via Pix</span>
            </div>

            {!customerClaimedPaidAt ? (
              <div className="cf-pix-block">
                {pixLoading && (
                  <div className="cf-tracker-loading">
                    <div className="cf-loading-bar" />
                    <p>Gerando QR Code...</p>
                  </div>
                )}
                {pixError && <div className="cf-modal-error">⚠️ {pixError}</div>}
                {pixCharge && !pixLoading && (
                  <>
                    <p className="cf-pix-instructions">
                      Escaneie o QR Code ou copie o código abaixo no app do seu banco.
                    </p>
                    {pixQrImage && (
                      <img src={pixQrImage} alt="QR Code Pix" className="cf-pix-qr" />
                    )}
                    <div className="cf-pix-value">{formatBRL(pixCharge.amount)}</div>
                    <div className="cf-pix-code-row">
                      <input readOnly value={pixCharge.brCode} className="cf-pix-code-input" />
                      <button className="cf-btn-home" onClick={handleCopyPixCode}>
                        {copied ? "✓ Copiado" : "Copiar código"}
                      </button>
                    </div>
                    <button
                      className="cf-btn-cancel"
                      onClick={handleMarkPaid}
                      disabled={claimingPaid}
                    >
                      {claimingPaid ? "Aguarde..." : "✅ Já paguei"}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="cf-pix-waiting">
                <p className="cf-pix-waiting-title">⏳ Aguardando confirmação do pagamento pela loja</p>
                <p className="cf-pix-waiting-hint">
                  Assim que a loja confirmar o recebimento, seu pedido segue pro
                  preparo normalmente. Isso costuma levar só alguns minutos.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TRACKER — apenas entrega */}
        {!isRetirada && !isPixPending && (
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
                  <div
                    className="cf-progress-fill"
                    style={{ width: `${(currentStep / 3) * 100}%` }}
                  />
                </div>

                <div className="cf-steps">
                  {STEPS.map((step, i) => {
                    const isDone = i < currentStep;
                    const isActive = i === currentStep;
                    const isPending = i > currentStep;
                    return (
                      <div
                        key={i}
                        className={[
                          "cf-step",
                          isDone && "cf-step-done",
                          isActive && "cf-step-active",
                          isPending && "cf-step-pending",
                          animating && isActive && "cf-step-entering",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <div className="cf-step-icon-wrap">
                          <div className="cf-step-icon">
                            {isDone ? "✓" : step.icon}
                          </div>
                          {isActive && <div className="cf-step-pulse" />}
                        </div>
                        <div className="cf-step-info">
                          <span className="cf-step-title">{step.title}</span>
                          <span className="cf-step-desc">
                            {isActive ? step.activeDesc : step.desc}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className={`cf-status-msg cf-status-msg-${status}`}>
                  <span className="cf-status-msg-icon">
                    {STEPS[currentStep].icon}
                  </span>
                  <span className="cf-status-msg-text">
                    {STEPS[currentStep].activeDesc}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* TRACKER — retirada */}
        {isRetirada && !isPixPending && (
          <div className="cf-tracker-card cf-tracker-card--pickup">
            <div className="cf-tracker-header">
              <span className="cf-tracker-label">🏪 RETIRADA NA LOJA</span>
            </div>
            <div className="cf-pickup-body">
              <div className="cf-pickup-icon">🏪</div>
              <h3 className="cf-pickup-title">Seu pedido está pronto!</h3>
              <p className="cf-pickup-desc">
                Passe na loja com seu código de retirada.
              </p>
              <div className="cf-pickup-address">
                <p className="cf-pickup-address-label">ENDEREÇO</p>
                <p className="cf-pickup-address-street">
                  Rua Edgar Torres, 650
                </p>
                <p className="cf-pickup-address-city">
                  Minas Caixa, Belo Horizonte - MG
                </p>
              </div>
            </div>
          </div>
        )}

        {/* GRID */}
        <div className="cf-grid">
          {/* Coluna esquerda */}
          <div className="cf-col">
            <div className="cf-card">
              <div className="cf-card-label">🛒 Itens do Pedido</div>
              <div className="cf-items">
                {cartItems.map((item, i) => (
                  <div className="cf-item" key={i}>
                    <div className="cf-item-img">
                      {item.imagem || item.icon ? (
                        <img
                          src={imgProduto(item.imagem || item.icon)}
                          alt={item.nome || item.name}
                        />
                      ) : (
                        "🍺"
                      )}
                    </div>
                    <div className="cf-item-info">
                      <span className="cf-item-name">
                        {item.nome || item.name}
                      </span>
                      <span className="cf-item-qty">
                        {item.quantity} unidade(s)
                      </span>
                    </div>
                    <span className="cf-item-price">
                      {formatBRL((item.preco || item.price) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="cf-total-row">
                <span>Total pago</span>
                <span className="cf-total-value">{formatBRL(total)}</span>
              </div>
            </div>

            {!isRetirada && address?.name && (
              <div className="cf-card">
                <div className="cf-card-label">📍 Endereço de Entrega</div>
                <div className="cf-address">
                  <p className="cf-address-name">{address.name}</p>
                  <p>
                    {address.street}, {address.number}
                    {address.complement ? ` — ${address.complement}` : ""}
                  </p>
                  <p>{address.district}</p>
                  <p className="cf-address-phone">📞 {address.phone}</p>
                </div>
              </div>
            )}
          </div>

          {/* Coluna direita */}
          <div className="cf-col">
            <div className="cf-card cf-card-payment">
              <div className="cf-card-label">💳 Forma de Pagamento</div>
              <div className="cf-payment">
                <span className="cf-payment-icon">{paymentInfo.icon}</span>
                <span className="cf-payment-label">
                  {paymentInfo.label}
                  {payment === "credit_card" && installments > 1
                    ? ` em ${installments}x`
                    : ""}
                </span>
              </div>
            </div>

            <button className="cf-btn-home" onClick={() => navigate("/")}>
              🏠 Voltar para a loja
            </button>

            {canCancel && (
              <button
                className="cf-btn-cancel"
                onClick={() => setShowCancelModal(true)}
              >
                ✕ Cancelar {entityLabel}
              </button>
            )}

            {!canCancel &&
              (orderId || isRetirada) &&
              status !== "pending" &&
              status !== "rejected" && (
                <div className="cf-cancel-info">
                  <p>
                    ℹ️ Não é mais possível cancelar — {entityLabel} já está em
                    andamento.
                  </p>
                  <a href="https://wa.me/553183077990" target="_blank" className="text-bold text-decoration-none fs-6 text-white">
                    <div className="border border-secondary rounded bg-success p-2">
                      <span>Falar com atendente <i className="bi bi-whatsapp"></i></span>
                    </div>
                  </a>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
