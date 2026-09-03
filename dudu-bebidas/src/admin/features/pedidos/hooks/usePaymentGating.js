// Deriva se o preparo do pedido está bloqueado até o pagamento ser
// confirmado — pix (confirmação manual do admin) e cartão online via
// Mercado Pago (confirmação automática por webhook) têm regras distintas.
export function usePaymentGating(order) {
  // Pix ainda não confirmado pelo admin — não faz sentido aceitar/rejeitar
  // preparo de algo que ainda não foi pago. "Pagamento na entrega" nasce
  // com payment_status "aguardando_pagamento" também (é só registro, não
  // bloqueia nada), então essa checagem é restrita a pix de propósito. Só
  // esse caso mostra o botão "Marcar como pago" — cartão online (Mercado
  // Pago) é confirmado sozinho pelo webhook; um botão manual aqui pularia
  // a baixa de estoque, que só acontece na confirmação real do pagamento.
  const pixAwaitingPayment =
    order.payment_method === "pix" && order.payment_status === "aguardando_pagamento";
  // Cartão online ainda não aprovado (ou recusado) — mesma lógica de
  // "não deixa aceitar/rejeitar preparo de algo que ainda não foi pago",
  // só que sem botão manual: a confirmação é automática via webhook.
  const mercadopagoNotPaid =
    order.payment_method === "mercadopago_card" && order.payment_status !== "pago";
  const paymentBlocksAcceptance = pixAwaitingPayment || mercadopagoNotPaid;

  return { pixAwaitingPayment, mercadopagoNotPaid, paymentBlocksAcceptance };
}
