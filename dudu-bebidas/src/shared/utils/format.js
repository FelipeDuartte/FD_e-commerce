// toLocaleString cuida dos dois separadores de uma vez (milhar com ponto,
// decimal com vírgula) — versões antigas espalhadas pelo projeto (toFixed +
// replace, ou só toFixed sem replace nenhum) nunca colocavam o ponto de
// milhar (R$ 1500,00 em vez de R$ 1.500,00). Fonte única — antes existiam
// 3 cópias divergentes (ProductCard.jsx, confirmUtils.js, adminFormat.js).
export const formatBRL = (value) =>
  `R$ ${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
