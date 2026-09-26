import { useCallback, useState } from "react";
import { getNext } from "../orderStatus";
import { rejectAdminOrder, updateAdminOrderStatus, assignCourierToOrder } from "../services/adminOrderService";
import { markOrderPaid } from "../../loja/pagamentos/services/paymentConfigService";

// Ações de mutação sobre um pedido: avançar status, definir status, marcar
// pago, rejeitar (com o modal de confirmação). Recebe setOrders/
// updateOrderStatusLocally/setOrdersError de useOrdersList — não é dono da
// lista, só a atualiza depois de cada ação.
export function useOrderActions({ setOrders, updateOrderStatusLocally, setOrdersError }) {
  const [updating, setUpdating] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState("");

  const advanceStatus = useCallback(
    async (order) => {
      const next = getNext(order);
      if (!next) return;
      setUpdating(order.id);
      setOrdersError("");
      try {
        await updateAdminOrderStatus(order.id, next);
        updateOrderStatusLocally(order.id, next);
      } catch (error) {
        console.error(error);
        setOrdersError(error.message);
      }
      setUpdating(null);
    },
    [updateOrderStatusLocally, setOrdersError],
  );

  const setStatus = useCallback(
    async (orderId, newStatus) => {
      setUpdating(orderId);
      setOrdersError("");
      try {
        await updateAdminOrderStatus(orderId, newStatus);
        updateOrderStatusLocally(orderId, newStatus);
      } catch (error) {
        console.error(error);
        setOrdersError(error.message);
      }
      setUpdating(null);
    },
    [updateOrderStatusLocally, setOrdersError],
  );

  // Pix Fase 1: só registro informativo — não mexe em estoque nem no status
  // de preparo/entrega, só marca payment_status como pago.
  const markPaid = useCallback(async (orderId) => {
    setUpdating(orderId);
    setOrdersError("");
    try {
      await markOrderPaid(orderId);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, payment_status: "pago" } : o)),
      );
    } catch (error) {
      console.error(error);
      setOrdersError(error.message);
    }
    setUpdating(null);
  }, [setOrders, setOrdersError]);

  const assignCourier = useCallback(async (orderId, courier) => {
    setUpdating(orderId);
    setOrdersError("");
    try {
      await assignCourierToOrder(orderId, courier);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, courier_id: courier.id, courier_name: courier.name, courier_phone: courier.phone }
            : o,
        ),
      );
    } catch (error) {
      console.error(error);
      setOrdersError(error.message);
    }
    setUpdating(null);
  }, [setOrders, setOrdersError]);

  const confirmReject = useCallback(async () => {
    if (!rejectModal) return;
    setRejecting(true);
    setRejectError("");

    try {
      await rejectAdminOrder(rejectModal.id);
    } catch (error) {
      console.error(error);
      setRejectError(error.message);
      setRejecting(false);
      return;
    }

    // rejectAdminOrder não apaga mais — só atualiza o status localmente
    // (updateOrderStatusLocally já cuida de sumir da tela só se passar 24h,
    // igual todo o resto).
    updateOrderStatusLocally(rejectModal.id, "rejected");
    setRejectModal(null);
    setRejecting(false);
  }, [rejectModal, updateOrderStatusLocally]);

  const closeRejectModal = useCallback(() => {
    if (!rejecting) {
      setRejectModal(null);
      setRejectError("");
    }
  }, [rejecting]);

  return {
    updating, rejectModal, setRejectModal, rejecting, rejectError,
    advanceStatus, setStatus, markPaid, assignCourier, confirmReject, closeRejectModal,
  };
}
