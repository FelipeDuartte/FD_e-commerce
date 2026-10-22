// Preço de tabela do balcão — a promoção do site não vale aqui (usa
// old_price se o site estiver em promoção). Espelha o priceFor() de
// supabase/functions/_shared/orderFulfillment.ts, que é quem cobra de fato.
export function getPdvPrice(product) {
  return product.promotion && product.old_price != null ? product.old_price : product.price;
}

// Promoção própria do PDV (aplicada pelo operador no card da Venda).
export function getPdvPromoPrice(product) {
  return product.pdv_promo_price != null ? Number(product.pdv_promo_price) : null;
}
