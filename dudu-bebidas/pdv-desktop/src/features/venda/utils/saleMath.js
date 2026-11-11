import { roundCents } from "./creditFee";

// Contas da venda no balcão — fora dos hooks pra serem testadas sem React
// (saleMath.test.js). Tudo arredondado em centavos: sem isso, 5,90 + 7,20
// virava 13,100000000000001 e R$ 13,10 recebidos davam "dinheiro insuficiente".

/** Soma dos itens (preço × quantidade). */
export function calcSubtotal(cart) {
  return roundCents(cart.reduce((sum, i) => sum + i.price * i.quantity, 0));
}

/**
 * Desconto em R$ a partir do que o operador digitou: valor ("amount") ou
 * porcentagem ("percent"). Nunca negativo nem maior que o subtotal.
 */
export function calcDiscount(subtotal, mode, input) {
  const raw = Number(input);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const amount = mode === "percent" ? subtotal * (raw / 100) : raw;
  return roundCents(Math.min(Math.max(0, amount), subtotal));
}

/** Troco do pagamento em dinheiro. null = ainda não digitou um valor válido. */
export function calcChange(receivedInput, total) {
  if (receivedInput === "") return null;
  const received = Number(receivedInput);
  if (!Number.isFinite(received)) return null;
  return roundCents(received - total);
}

/**
 * Pagamento dividido: quanto já foi distribuído, quanto falta e se a
 * divisão está pronta (2+ formas, todas com valor, somando o total).
 */
export function summarizeSplit(payments, total) {
  const paid = roundCents(payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0));
  const remaining = roundCents(total - paid);
  const valid =
    payments.length >= 2 &&
    payments.every((p) => p.method && Number(p.amount) > 0) &&
    Math.abs(remaining) < 0.01;
  return { paid, remaining, valid };
}
