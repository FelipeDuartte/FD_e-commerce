-- ─────────────────────────────────────────────────────────────
-- Desconto manual em venda (hoje só usado pelo PDV — atendente pode
-- dar desconto que cliente do site não tem). Genérico em orders pra
-- não impedir uso futuro no checkout online (ex: cupom).
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.orders
  ADD COLUMN discount_amount numeric(10,2) NOT NULL DEFAULT 0;
