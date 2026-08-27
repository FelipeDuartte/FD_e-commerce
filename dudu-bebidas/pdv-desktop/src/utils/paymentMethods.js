// Espelha src/utils/paymentMethods.js do app web — só os valores que o PDV
// realmente usa (venda de balcão nunca gera pix online nem cartão MP).
export const PAYMENT_METHODS = {
  debit_card: { icon: "💳", label: "Débito" },
  credit_card: { icon: "💳", label: "Crédito" },
  cash: { icon: "💵", label: "Dinheiro" },
  pix: { icon: "⚡", label: "Pix" },
  // Venda sem cobrança na hora — vira dívida do cliente (ver pdv_customers).
  fiado: { icon: "📒", label: "Fiado" },
};
