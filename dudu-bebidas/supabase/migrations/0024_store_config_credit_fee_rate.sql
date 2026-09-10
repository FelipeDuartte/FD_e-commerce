BEGIN;

-- Taxa da maquininha por parcela (1x a 8x) — fonte única lida pelo site,
-- PDV e orderFulfillment.ts, em vez de cada um ter sua cópia hardcoded.
-- Seed com os valores atuais, então nada muda de comportamento até
-- alguém editar essa linha.
ALTER TABLE public.store_config
  ADD COLUMN IF NOT EXISTS credit_installment_fee_rate jsonb NOT NULL DEFAULT '{
    "1": 0.0326, "2": 0.057, "3": 0.0652, "4": 0.0736,
    "5": 0.0819, "6": 0.0903, "7": 0.0988, "8": 0.1073
  }'::jsonb;

COMMIT;
