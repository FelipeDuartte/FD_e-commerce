// toLocaleString cuida dos dois separadores de uma vez (milhar com ponto,
// decimal com vírgula) — o jeito antigo (toFixed + replace) só trocava o
// decimal e nunca colocava o ponto de milhar (R$ 1500,00 em vez de R$ 1.500,00).
export const formatBRL = (value) =>
  `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const daysSince = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

export const formatLastOrder = (iso) => {
  if (!iso) return "nunca comprou";
  const days = daysSince(iso);
  if (days <= 0) return "última compra hoje";
  if (days === 1) return "última compra ontem";
  return `última compra há ${days} dias`;
};

export const formatPhone = (raw) => {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return raw;
};
