BEGIN;

-- Permite o admin ligar/desligar cada forma de pagamento do checkout sem
-- mexer em código. Default: tudo ligado (igual já funciona hoje) — nenhum
-- pedido existente ou loja já configurada muda de comportamento sozinha.
-- "fiado" fica de fora de propósito: é exclusivo do PDV, nunca aparece
-- no checkout do site (ver deliveryPaymentOptions/onlinePaymentOptions em
-- src/page/Checkout/checkoutConstants.js).
ALTER TABLE public.store_config
  ADD COLUMN IF NOT EXISTS payment_methods_enabled jsonb NOT NULL DEFAULT '{
    "pix": true,
    "pix_entrega": true,
    "debit_card": true,
    "credit_card": true,
    "cash": true,
    "mercadopago_card": true
  }'::jsonb;

COMMIT;
