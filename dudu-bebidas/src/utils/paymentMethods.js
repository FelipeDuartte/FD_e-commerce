// Fonte única dos métodos de pagamento — antes duplicado em Checkout.jsx,
// Confirm.jsx, adminUtils.js e AdminPDV.jsx, cada um com sua própria cópia.
export const PAYMENT_METHODS = {
  pix: { icon: "⚡", label: "PIX" },
  debit_card: { icon: "💳", label: "Débito" },
  credit_card: { icon: "💳", label: "Crédito" },
  card: { icon: "💳", label: "Cartão" }, // pedidos antigos, antes de separar débito/crédito
  cash: { icon: "💵", label: "Dinheiro" },
};

// Lista pra uso em seletores (radio/botões) — ordem usada no checkout e no PDV.
export const PAYMENT_METHOD_OPTIONS = [
  { value: "pix", ...PAYMENT_METHODS.pix },
  { value: "debit_card", ...PAYMENT_METHODS.debit_card },
  { value: "credit_card", ...PAYMENT_METHODS.credit_card },
  { value: "cash", ...PAYMENT_METHODS.cash },
];
