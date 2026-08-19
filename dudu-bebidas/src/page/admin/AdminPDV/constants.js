import { PAYMENT_METHODS as PAYMENT_METHOD_LABELS } from "../../../utils/paymentMethods";

// Dinheiro primeiro no PDV (maioria das vendas de balcão é em dinheiro) —
// ordem diferente do checkout online, mas os rótulos vêm da fonte única.
export const PAYMENT_METHODS = ["cash", "pix", "debit_card", "credit_card"].map((value) => ({
  value,
  ...PAYMENT_METHOD_LABELS[value],
}));

// Menu lateral do PDV — pensado já com o app desktop separado em mente
// (Tauri, futuramente): cada item aqui vira uma "tela" própria, igual um
// POS de verdade (Venda / Histórico / ...). Hoje ainda mora dentro do
// admin web, mas a navegação já fica isolada do resto do painel.
export const PDV_VIEWS = [
  { key: "venda", label: "🛒 Venda" },
  { key: "historico", label: "📋 Histórico" },
];
