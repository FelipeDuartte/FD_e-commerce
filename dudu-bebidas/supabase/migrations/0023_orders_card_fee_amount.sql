BEGIN;

-- Parte do total que é taxa da maquininha (crédito parcelado), separada do
-- valor do produto — pra relatório nunca contar taxa como faturamento.
-- DEFAULT 0: pedido antigo/sem taxa não muda de comportamento.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS card_fee_amount numeric(10,2) NOT NULL DEFAULT 0;

COMMIT;
