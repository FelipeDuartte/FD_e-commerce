
/**
 * Formata um número como Real brasileiro: "R$ 12,50".
 * @param {number|string} value
 * @returns {string}
 */
export const formatBRL = (value) =>
  `R$ ${Number(value).toFixed(2).replace(".", ",")}`;
