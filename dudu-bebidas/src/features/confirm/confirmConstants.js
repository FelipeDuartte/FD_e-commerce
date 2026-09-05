export const STATUS_STEP = { pending: 0, preparing: 1, on_the_way: 2, delivered: 3 };

export const STATUS_POLL_INTERVAL_MS = 5000;
export const TERMINAL_STATUSES = ["rejected", "cancelled", "delivered"];

export const STEPS = [
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

export const EMPTY_ORDER = {
  orderId: null,
  orderNumber: null,
  cartItems: [],
  total: 0,
  payment: "pix",
  installments: null,
  address: {},
  isRetirada: false,
};
