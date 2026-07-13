
/**
 * @param {string} id - id completo do pedido
 * @returns {string} últimos 8 caracteres, em maiúsculas
 */
export const shortOrderId = (id) => id.slice(-8).toUpperCase();
