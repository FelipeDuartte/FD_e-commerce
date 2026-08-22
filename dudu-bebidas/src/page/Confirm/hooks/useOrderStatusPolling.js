import { useEffect, useState } from "react";
import { supabase, getCurrentStoreId } from "../../../supabase/Supabaseclient";
import { STATUS_POLL_INTERVAL_MS, TERMINAL_STATUSES } from "../confirmConstants";

// Status do pedido via polling na RPC get_order_status (não Realtime — ver
// motivo no comentário original: Realtime exigiria uma policy de SELECT em
// orders que qualquer anônimo poderia explorar pra listar todos os pedidos
// da loja). A mesma RPC também devolve payment_status/customer_claimed_paid_at,
// usados pelo fluxo de Pix (ver usePixCharge).
export function useOrderStatusPolling(orderId) {
  const [status, setStatus] = useState("pending");
  const [statusLoading, setStatusLoading] = useState(true);
  const [animating, setAnimating] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [customerClaimedPaidAt, setCustomerClaimedPaidAt] = useState(null);
  const [showRejectedModal, setShowRejectedModal] = useState(false);
  const [showCancelledModal, setShowCancelledModal] = useState(false);

  useEffect(() => {
    if (!orderId) {
      const timer = setTimeout(() => setStatusLoading(false), 0);
      return () => clearTimeout(timer);
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

  return {
    status,
    statusLoading,
    animating,
    paymentStatus,
    customerClaimedPaidAt,
    setCustomerClaimedPaidAt,
    showRejectedModal,
    showCancelledModal,
  };
}
