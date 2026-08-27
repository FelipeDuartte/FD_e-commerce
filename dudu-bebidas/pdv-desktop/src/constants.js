import { PAYMENT_METHODS as PAYMENT_METHOD_LABELS } from "./utils/paymentMethods";

// Dinheiro primeiro (maioria das vendas de balcão é em dinheiro).
export const PAYMENT_METHODS = ["cash", "pix", "debit_card", "credit_card", "fiado"].map((value) => ({
  value,
  ...PAYMENT_METHOD_LABELS[value],
}));

// Mesma lista, mas sem fiado — usada no seletor de pagamento dividido, que
// não suporta fiado como uma das formas (ver orderFulfillment.ts).
export const SPLIT_PAYMENT_METHODS = PAYMENT_METHODS.filter((m) => m.value !== "fiado");

export const PDV_VIEWS = [
  { key: "venda", label: "🛒 Venda" },
  { key: "historico", label: "📋 Histórico" },
  { key: "fiado", label: "👤 Fiado" },
];

// Promoção é exclusiva do site — o balcão sempre cobra o preço de tabela
// (old_price), mesmo com o produto em promoção online. Espelha exatamente
// o priceFor() de supabase/functions/_shared/orderFulfillment.ts (fonte da
// verdade do valor cobrado); isso aqui é só pra exibir o mesmo valor no PDV.
export function getPdvPrice(product) {
  return product.promotion && product.old_price != null ? product.old_price : product.price;
}
