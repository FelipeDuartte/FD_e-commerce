const cents = (n) => Math.round(Number(n || 0) * 100) / 100;

/**
 * Valores da notinha de um pedido do site: subtotal dos itens, frete (o que
 * sobra do total), desconto e taxa do cartão.
 */
export function receiptTotals(order) {
  const items = order.order_items ?? [];
  const itemsTotal = cents(items.reduce((sum, it) => sum + Number(it.price) * it.quantity, 0));
  const discount = cents(order.discount_amount);
  const cardFee = cents(order.card_fee_amount);
  const delivery = Math.max(0, cents(Number(order.total) - cardFee + discount - itemsTotal));
  return { itemsTotal, discount, cardFee, delivery };
}
