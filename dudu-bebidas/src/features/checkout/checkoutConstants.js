import { PAYMENT_METHODS } from "../../shared/utils/paymentMethods";

const buildOptions = (values) =>
  values.map((value) => ({
    value,
    icon: PAYMENT_METHODS[value].icon,
    name: PAYMENT_METHODS[value].label,
  }));

// Pago só quando o pedido chega (dinheiro/maquininha na mão, ou Pix
// informal mostrado ao entregador) — nenhuma dessas opções ativa cobrança
// automática nem tela de "aguardando confirmação".
export const deliveryPaymentOptions = buildOptions(["credit_card", "debit_card", "pix_entrega", "cash"]);

// Pago no ato do checkout, antes de qualquer entrega — Pix mostra QR na
// tela de confirmação; Cartão online (Mercado Pago) só aparece se a loja
// já configurou as credenciais (ver mpConfig.enabled em Checkout.jsx).
export const onlinePaymentOptions = buildOptions(["pix"]);

// Pagamento é feito na entrega (maquininha do entregador) — isso só define
// em quantas vezes o cliente PRETENDE parcelar, pra facilitar quem vai
// levar a máquina certa. Ajuste o máximo aqui se seu maquininha permitir mais.
// Dono da loja pediu pra credito aceitar só à vista (1x) por enquanto —
// se um dia quiser voltar a parcelar, é só subir esse número de novo (o
// resto do código já lida com qualquer valor, inclusive o seletor de
// parcelas mais abaixo, que só aparece quando MAX_INSTALLMENTS > 1).
export const MAX_INSTALLMENTS = 1;
export const INSTALLMENT_OPTIONS = Array.from({ length: MAX_INSTALLMENTS }, (_, i) => i + 1);

// Taxas reais da maquininha (crédito), tiradas direto do visor dela.
// Mesmo "à vista" (1x) tem taxa — é assim que a máquina cobra. Parado em 8x
// porque foi até onde deu pra ler no print com certeza (9x tinha um dígito
// tampado) — manda o resto que eu completo a tabela.
// Se a taxa da maquininha mudar um dia, é só atualizar aqui (e no mesmo
// objeto dentro da Edge Function create-order, que recalcula o total
// de novo no servidor por segurança).
export const INSTALLMENT_FEE_RATE = {
  1: 0.0326,
  2: 0.057,
  3: 0.0652,
  4: 0.0736,
  5: 0.0819,
  6: 0.0903,
  7: 0.0988,
  8: 0.1073,
};

export const roundCents = (v) => Math.round(v * 100) / 100;

export function applyCreditCardFee(baseTotal, payment, installments) {
  if (payment !== "credit_card") return baseTotal;
  const rate = INSTALLMENT_FEE_RATE[installments] ?? 0;
  return roundCents(baseTotal * (1 + rate));
}

export const INITIAL_ADDRESS = {
  name: "",
  phone: "",
  street: "",
  number: "",
  district: "",
  complement: "",
  city: "",
  state: "",
};
