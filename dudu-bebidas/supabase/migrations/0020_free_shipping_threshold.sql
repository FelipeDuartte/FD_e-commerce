BEGIN;

-- NULL = frete grátis desativado (comportamento atual, sem mudança pra
-- quem nunca configurou). Valor > 0 = a partir desse subtotal de produtos,
-- o frete zera — aplicado tanto na exibição (Cart.jsx) quanto no servidor
-- (orderFulfillment.ts, que é quem decide o valor cobrado de verdade).
ALTER TABLE public.store_config
  ADD COLUMN IF NOT EXISTS free_shipping_threshold numeric NULL DEFAULT NULL;

COMMIT;
