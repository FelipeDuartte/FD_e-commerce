import { EMPTY_ORDER } from "./confirmConstants";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readSavedOrder() {
  try {
    const saved = localStorage.getItem("lastOrder");
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.warn("Pedido salvo inválido.", error);
    return null;
  }
}

/**
 * De onde vem o pedido mostrado na página:
 *   1. location.state — veio direto do Checkout;
 *   2. ?pedido=<código> — link do WhatsApp ("Acompanhar pedido"), que
 *      costuma abrir num navegador sem o pedido salvo: só o código; status,
 *      número e forma de pagamento vêm do servidor (get_order_status);
 *   3. localStorage — a página recarregou no mesmo navegador da compra.
 */
export function resolveOrderData(locationState, search = "") {
  if (locationState?.orderId || locationState?.cartItems) return locationState;
  if (locationState?.pedido) return locationState.pedido;

  const saved = readSavedOrder();
  const linkId = new URLSearchParams(search).get("pedido");
  if (linkId && UUID_RE.test(linkId)) {
    if (saved?.orderId === linkId) return saved; // mesmo navegador: dados completos
    return { ...EMPTY_ORDER, orderId: linkId, payment: null, fromLink: true };
  }
  return saved ?? EMPTY_ORDER;
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
