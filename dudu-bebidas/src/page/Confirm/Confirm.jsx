import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase, getCurrentStoreId } from "../../supabase/Supabaseclient";
import "./Confirm.css";
import { EMPTY_ORDER } from "./confirmConstants";
import { resolveOrderData } from "./confirmUtils";
import { useOrderStatusPolling } from "./hooks/useOrderStatusPolling";
import { usePixCharge } from "./hooks/usePixCharge";
import CancelOrderModal from "./components/CancelOrderModal";
import OrderOutcomeModal from "./components/OrderOutcomeModal";
import PixPendingCard from "./components/PixPendingCard";
import MercadoPagoProcessingCard from "./components/MercadoPagoProcessingCard";
import DeliveryTracker from "./components/DeliveryTracker";
import PickupCard from "./components/PickupCard";
import OrderItemsCard from "./components/OrderItemsCard";
import DeliveryAddressCard from "./components/DeliveryAddressCard";
import PaymentMethodCard from "./components/PaymentMethodCard";

// ══════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════
export default function Confirmacao() {
  const location = useLocation();
  const navigate = useNavigate();

  const [orderData] = useState(() => resolveOrderData(location.state));

  const { orderId, orderNumber, cartItems, total, payment, installments, address, isRetirada } = {
    ...EMPTY_ORDER,
    ...orderData,
  };

  const {
    status,
    statusLoading,
    animating,
    paymentStatus,
    customerClaimedPaidAt,
    setCustomerClaimedPaidAt,
    showRejectedModal,
    showCancelledModal,
  } = useOrderStatusPolling(orderId);

  const isPixPending = payment === "pix" && paymentStatus === "aguardando_pagamento";
  // Cartão online (Mercado Pago): a confirmação é automática via webhook,
  // não tem QR nem "já paguei" — só um estado de espera/erro enquanto
  // payment_status ainda não virou 'pago'.
  const isMercadoPagoPending =
    payment === "mercadopago_card" &&
    ["processando_pagamento", "aguardando_pagamento"].includes(paymentStatus);
  const isMercadoPagoRejected =
    payment === "mercadopago_card" && paymentStatus === "pagamento_recusado";

  const {
    pixCharge,
    pixQrImage,
    pixLoading,
    pixError,
    claimingPaid,
    copied,
    handleMarkPaid,
    handleCopyPixCode,
  } = usePixCharge({
    orderId,
    isPixPending,
    customerClaimedPaidAt,
    onMarkPaid: () => setCustomerClaimedPaidAt(new Date().toISOString()),
  });

  // ── Modal cancelamento ────────────────────────────
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  // ── Persiste no localStorage ──────────────────────
  useEffect(() => {
    if (orderId || cartItems.length > 0) {
      localStorage.setItem(
        "lastOrder",
        JSON.stringify({
          orderId,
          orderNumber,
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
  }, [orderId, orderNumber, cartItems, total, payment, installments, address, isRetirada]);

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

  const shortId = orderNumber ? String(orderNumber) : orderId ? orderId.slice(-8).toUpperCase() : "RETIRADA";
  const canCancel = status === "pending" && (orderId || isRetirada);
  const entityLabel = isRetirada ? "retirada" : "pedido";

  return (
    <div className="cf-root">
      <div className="cf-particle cf-p1" />
      <div className="cf-particle cf-p2" />
      <div className="cf-particle cf-p3" />

      {showCancelModal && (
        <CancelOrderModal
          entityLabel={entityLabel}
          shortId={shortId}
          cancelling={cancelling}
          cancelError={cancelError}
          onClose={() => setShowCancelModal(false)}
          onConfirm={handleCancelOrder}
        />
      )}

      {showRejectedModal && (
        <OrderOutcomeModal icon="😔" title="Pedido rejeitado" onClose={() => navigate("/")}>
          Infelizmente seu {entityLabel} <strong>#{shortId}</strong> foi{" "}
          <strong>rejeitado</strong> pela loja. Nenhum valor foi cobrado. Se
          tiver dúvidas, entre em contato com a loja.
        </OrderOutcomeModal>
      )}

      {showCancelledModal && (
        <OrderOutcomeModal icon="🚫" title="Pedido cancelado" onClose={() => navigate("/")}>
          Seu {entityLabel} <strong>#{shortId}</strong> foi{" "}
          <strong>cancelado</strong>. Nenhum valor foi cobrado. Se foi um
          engano, é só fazer um novo pedido.
        </OrderOutcomeModal>
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

        {isPixPending && (
          <PixPendingCard
            customerClaimedPaidAt={customerClaimedPaidAt}
            pixLoading={pixLoading}
            pixError={pixError}
            pixCharge={pixCharge}
            pixQrImage={pixQrImage}
            copied={copied}
            claimingPaid={claimingPaid}
            onCopyCode={handleCopyPixCode}
            onMarkPaid={handleMarkPaid}
          />
        )}

        {(isMercadoPagoPending || isMercadoPagoRejected) && (
          <MercadoPagoProcessingCard rejected={isMercadoPagoRejected} />
        )}

        {!isRetirada && !isPixPending && !isMercadoPagoPending && !isMercadoPagoRejected && (
          <DeliveryTracker status={status} statusLoading={statusLoading} animating={animating} />
        )}

        {isRetirada && !isPixPending && !isMercadoPagoPending && !isMercadoPagoRejected && <PickupCard />}

        {/* GRID */}
        <div className="cf-grid">
          <div className="cf-col">
            <OrderItemsCard cartItems={cartItems} total={total} />
            {!isRetirada && address?.name && <DeliveryAddressCard address={address} />}
          </div>

          <div className="cf-col">
            <PaymentMethodCard payment={payment} installments={installments} />

            <button className="cf-btn-home" onClick={() => navigate("/")}>
              🏠 Voltar para a loja
            </button>

            {canCancel && (
              <button className="cf-btn-cancel" onClick={() => setShowCancelModal(true)}>
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
