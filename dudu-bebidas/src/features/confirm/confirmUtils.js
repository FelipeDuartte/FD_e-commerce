import { EMPTY_ORDER } from "./confirmConstants";

// Lê o pedido do location.state (veio direto do Checkout) ou, se a página
// recarregar, do localStorage (última compra salva).
export function resolveOrderData(locationState) {
  if (locationState?.orderId || locationState?.cartItems) return locationState;
  if (locationState?.pedido) return locationState.pedido;

  const saved = localStorage.getItem("lastOrder");
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (error) {
      console.warn("Pedido salvo inválido.", error);
    }
  }
  return EMPTY_ORDER;
}

export { formatBRL } from "../../shared/utils/format";

const cents = (v) => Math.round(v * 100) / 100;

/**
 * Linhas do resumo do pedido: subtotal dos produtos, entrega e o que mais
 * entrou no total (taxa do cartão). O total vem do servidor e já inclui
 * tudo — sem essas linhas, R$ 10,90 de produto + R$ 5,00 de frete aparecia
 * só como "Total R$ 15,90", parecendo erro.
 *
 * Pedido antigo salvo no navegador (sem deliveryFee): mostra a diferença
 * como "Entrega e taxas".
 */
export function orderBreakdown(cartItems, total, deliveryFee) {
  const subtotal = cents(
    cartItems.reduce((sum, item) => sum + (item.preco ?? item.price ?? 0) * item.quantity, 0),
  );
  const rest = cents(Number(total) - subtotal);

  if (deliveryFee == null) {
    return { subtotal, deliveryFee: null, cardFee: 0, otherFees: rest > 0 ? rest : 0 };
  }
  const fee = cents(Number(deliveryFee));
  const cardFee = cents(rest - fee);
  return { subtotal, deliveryFee: fee, cardFee: cardFee > 0 ? cardFee : 0, otherFees: 0 };
}
