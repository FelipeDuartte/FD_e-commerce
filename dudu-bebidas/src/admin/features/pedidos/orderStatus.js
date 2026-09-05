export { PAYMENT_METHODS as PAYMENT_LABEL } from "../../../shared/utils/paymentMethods";

export const PAGE_SIZE = 20;

export const STATUS_PICKUP = {
  pending: {
    label: "Aguardando",
    icon: "🕐",
    color: "#ffd000",
    next: "delivered",
  },
  delivered: { label: "Entregue", icon: "✅", color: "#50c878", next: null },
  rejected: { label: "Rejeitado", icon: "❌", color: "#e74c3c", next: null },
  cancelled: { label: "Cancelado", icon: "🚫", color: "#888", next: null },
};

export const STATUS_DELIVERY = {
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
  rejected: { label: "Rejeitado", icon: "❌", color: "#e74c3c", next: null },
  cancelled: { label: "Cancelado", icon: "🚫", color: "#888", next: null },
};

export const DELIVERY_STATUS_ORDER = [
  "pending",
  "preparing",
  "on_the_way",
  "delivered",
];
export const PICKUP_STATUS_ORDER = ["pending", "delivered"];

export const isPickup = (order) => order.address?.isRetirada === true;
export const getStatusMap = (order) =>
  isPickup(order) ? STATUS_PICKUP : STATUS_DELIVERY;
export const getConfig = (order) =>
  getStatusMap(order)[order.status] ?? STATUS_DELIVERY.pending;
export const getStatuses = (order) =>
  isPickup(order) ? PICKUP_STATUS_ORDER : DELIVERY_STATUS_ORDER;
export const getNext = (order) => getConfig(order).next;

// Pedidos de cartão online (Mercado Pago) cuja cobrança falhou nunca viraram
// venda de verdade — o cliente nunca pagou, o estoque nunca foi baixado. Não
// faz sentido aparecer no painel como se fosse um pedido esperando ação do
// admin, então esses nem chegam a entrar na lista (diferente de
// shouldRemoveOrder, que é sobre "idade" — aqui é "nunca deveria ter
// aparecido").
const MERCADOPAGO_FAILED_STATUSES = ["pagamento_recusado", "pagamento_cancelado", "pagamento_expirado"];

export const isPhantomMercadoPagoOrder = (order) =>
  order.payment_provider === "mercadopago" && MERCADOPAGO_FAILED_STATUSES.includes(order.payment_status);

export const shouldRemoveOrder = (order) => {
  // Some do painel 24h depois de criado, pra qualquer status — exceto
  // "pending" (Aguardando), que precisa continuar visível até alguém agir.
  if (order.status === "pending") return false;
  const createdTime = new Date(order.created_at).getTime();
  const now = Date.now();
  const hoursPassed = (now - createdTime) / (1000 * 60 * 60);
  return hoursPassed >= 24;
};
