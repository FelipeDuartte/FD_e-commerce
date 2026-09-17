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

export function formatPaymentMethodLabel(method) {
  const known = PAYMENT_METHODS.find((m) => m.value === method);
  return known ? `${known.icon} ${known.label}` : method;
}

// Rótulo de pagamento pra exibição — quando a venda é dividida
// (payment_method === "misto"), mostra as formas REAIS que a compuseram
// (ex: "💵 Dinheiro + 💳 Crédito") em vez do rótulo genérico "misto", que
// não ajuda quem está conferindo o histórico ou a notinha impressa.
export function formatSalePaymentLabel(sale) {
  if (sale.paymentMethod !== "misto" || !sale.payments?.length) {
    return formatPaymentMethodLabel(sale.paymentMethod);
  }
  return sale.payments.map((p) => formatPaymentMethodLabel(p.method)).join(" + ");
}
