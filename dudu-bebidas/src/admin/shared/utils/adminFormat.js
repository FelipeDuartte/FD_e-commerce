// Únicos formatadores genuinamente cross-feature do admin (Pedidos,
// Relatórios e Loja>Bairros usam formatBRL; Pedidos usa formatDate).
export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export const formatBRL = (value) =>
  `R$ ${Number(value).toFixed(2).replace(".", ",")}`;
