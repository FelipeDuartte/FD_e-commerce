// Fonte única dos métodos de pagamento — antes duplicado em Checkout.jsx,
// Confirm.jsx, adminUtils.js e AdminPDV.jsx, cada um com sua própria cópia.
export const PAYMENT_METHODS = {
  // Pix pago na hora do checkout (QR + copia-e-cola, tela de "aguardando
  // confirmação") — distinto de pix_entrega, que é informal, pago só quando
  // o pedido chega. Rótulos diferentes de propósito: o admin (OrderCard)
  // mostra payment_method como texto solto, sem o agrupamento visual do
  // checkout — precisa dar pra diferenciar os dois só pelo rótulo.
  pix: { icon: "⚡", label: "Pix" },
  pix_entrega: { icon: "⚡", label: "Pix (entrega)" },
  debit_card: { icon: "💳", label: "Débito" },
  credit_card: { icon: "💳", label: "Crédito" },
  card: { icon: "💳", label: "Cartão" }, // pedidos antigos, antes de separar débito/crédito
  cash: { icon: "💵", label: "Dinheiro" },
  // Fase 2: cartão cobrado online via Mercado Pago (Card Payment Brick) —
  // distinto de credit_card, que continua sendo "cartão físico na entrega".
  mercadopago_card: { icon: "💳", label: "Cartão online" },
};
