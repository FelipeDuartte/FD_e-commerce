// Fonte única dos métodos de pagamento — antes duplicado em Checkout.jsx,
// Confirm.jsx, adminUtils.js e AdminPDV.jsx, cada um com sua própria cópia.
export const PAYMENT_METHODS = {
  // Pix já pago: online pela InfinitePay (o pedido "infinitepay" vira "pix"
  // quando confirma), no balcão do PDV ou pedidos antigos do Pix manual.
  // Distinto de pix_entrega, pago só quando o pedido chega.
  pix: { icon: "⚡", label: "Pix" },
  pix_entrega: { icon: "⚡", label: "Pix (entrega)" },
  debit_card: { icon: "💳", label: "Débito" },
  credit_card: { icon: "💳", label: "Crédito" },
  card: { icon: "💳", label: "Cartão" }, // pedidos antigos, antes de separar débito/crédito
  cash: { icon: "💵", label: "Dinheiro" },
  // Pedidos antigos pagos no Mercado Pago (não existe mais no checkout) —
  // fica só pra o histórico aparecer certo.
  mercadopago_card: { icon: "💳", label: "Cartão online" },
  // InfinitePay: o cliente escolhe Pix ou cartão na página da InfinitePay.
  // O pedido nasce "infinitepay" e, quando o pagamento confirma, vira "pix"
  // ou "online_card" (a forma usada de fato) — ver migration 0057.
  infinitepay: { icon: "🌐", label: "Pix ou cartão online" },
  online_card: { icon: "💳", label: "Cartão online" },
  // PDV: venda sem cobrança na hora, vira dívida do cliente (pdv_customers).
  fiado: { icon: "📒", label: "Fiado" },
};
