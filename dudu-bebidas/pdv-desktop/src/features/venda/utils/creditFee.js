// Taxas reais da maquininha do balcão — fonte primária agora é
// store_config.credit_installment_fee_rate (ver
// hooks/useStoreCreditFeeRate.js), mesma coluna que o site lê. Isso aqui
// vira só fallback, pro caso raro do fetch falhar ou a coluna vir nula —
// não precisa mais atualizar aqui toda vez que a taxa da maquininha mudar,
// só no banco.
export const DEFAULT_INSTALLMENT_FEE_RATE = {
  1: 0.0326,
  2: 0.057,
  3: 0.0652,
  4: 0.0736,
  5: 0.0819,
  6: 0.0903,
  7: 0.0988,
  8: 0.1073,
};

export const MAX_INSTALLMENTS_PDV = 8;

export const roundCents = (v) => Math.round(v * 100) / 100;

export function applyCreditCardFee(total, installments, rateTable = DEFAULT_INSTALLMENT_FEE_RATE) {
  const rate = rateTable[installments] ?? 0;
  return roundCents(total * (1 + rate));
}
