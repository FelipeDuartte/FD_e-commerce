// Promoção é exclusiva do site — o balcão sempre cobra o preço de tabela
// (old_price), mesmo com o produto em promoção online. Espelha exatamente
// o priceFor() de supabase/functions/_shared/orderFulfillment.ts (fonte da
// verdade do valor cobrado); isso aqui é só pra exibir o mesmo valor no PDV.
export function getPdvPrice(product) {
  return product.promotion && product.old_price != null ? product.old_price : product.price;
}
