import { PAYMENT_METHODS as PAYMENT_METHOD_LABELS } from "./utils/paymentMethods";

// Dinheiro primeiro (maioria das vendas de balcão é em dinheiro).
export const PAYMENT_METHODS = ["cash", "pix", "debit_card", "credit_card", "fiado"].map((value) => ({
  value,
  ...PAYMENT_METHOD_LABELS[value],
}));

// Mesma lista, mas sem fiado — usada no seletor de pagamento dividido, que
// não suporta fiado como uma das formas (ver orderFulfillment.ts).
export const SPLIT_PAYMENT_METHODS = PAYMENT_METHODS.filter((m) => m.value !== "fiado");

// Tamanho de página genérico usado pelas listagens paginadas do PDV
// (hoje só o histórico de estoque, mas não é específico de produto).
export const PAGE_SIZE = 20;
