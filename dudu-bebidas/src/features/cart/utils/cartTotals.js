import { roundCents } from "../../checkout/checkoutConstants";

/**
 * Totais do carrinho do site: subtotal, frete do bairro escolhido (zerado
 * acima do valor de frete grátis da loja) e total.
 *
 * @param {Array<{preco: number, quantity: number}>} items
 * @param {{frete: number} | null} zone - bairro escolhido (null = ainda não escolheu)
 * @param {number | null} freeShippingThreshold - store_config.free_shipping_threshold (null/0 = desligado)
 */
export function calcCartTotals(items, zone, freeShippingThreshold) {
  const subtotal = roundCents(items.reduce((sum, item) => sum + item.preco * item.quantity, 0));
  const freeShippingOn = freeShippingThreshold != null && freeShippingThreshold > 0;
  const qualifiesForFreeShipping = freeShippingOn && subtotal >= freeShippingThreshold;
  const rawFrete = zone ? zone.frete : null;
  const frete = rawFrete !== null && qualifiesForFreeShipping ? 0 : rawFrete;
  const total = frete !== null ? roundCents(subtotal + frete) : subtotal;
  const missingForFreeShipping = freeShippingOn && !qualifiesForFreeShipping
    ? roundCents(freeShippingThreshold - subtotal)
    : null;
  return { subtotal, qualifiesForFreeShipping, frete, total, missingForFreeShipping };
}
