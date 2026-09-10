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
