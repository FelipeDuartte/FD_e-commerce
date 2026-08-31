-- Campos opcionais de cadastro (e-mail, endereço) e status ativo/inativo
-- pro cliente fiado — desativar é reversível (esconde do seletor de venda,
-- mas mantém histórico); excluir de verdade só é permitido pra cliente sem
-- nenhuma venda/pagamento (a FK em orders.pdv_customer_id e
-- pdv_customer_payments.customer_id já bloqueia isso no banco).

-- IF NOT EXISTS pra poder rodar de novo com segurança (a tentativa
-- anterior pode ter aplicado essa parte antes de falhar na view).
ALTER TABLE public.pdv_customers ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.pdv_customers ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.pdv_customers ADD COLUMN IF NOT EXISTS address text;

-- CREATE OR REPLACE não deixa inserir colunas no meio da lista existente
-- (só apêndice no fim) — apaga e recria em vez de tentar substituir.
DROP VIEW IF EXISTS public.pdv_customer_balances;

CREATE VIEW public.pdv_customer_balances AS
SELECT
  c.id AS customer_id,
  c.store_id,
  c.name,
  c.phone,
  c.email,
  c.address,
  c.is_active,
  COALESCE(o.total_fiado, 0) AS total_fiado,
  COALESCE(p.total_paid, 0) AS total_paid,
  COALESCE(o.total_fiado, 0) - COALESCE(p.total_paid, 0) AS balance,
  o.last_order_at
FROM public.pdv_customers c
LEFT JOIN (
  SELECT pdv_customer_id, SUM(total) AS total_fiado, MAX(created_at) AS last_order_at
  FROM public.orders
  WHERE payment_method = 'fiado' AND status <> 'cancelled'
  GROUP BY pdv_customer_id
) o ON o.pdv_customer_id = c.id
LEFT JOIN (
  SELECT customer_id, SUM(amount) AS total_paid
  FROM public.pdv_customer_payments
  GROUP BY customer_id
) p ON p.customer_id = c.id;

ALTER VIEW public.pdv_customer_balances SET (security_invoker = true);
