-- Adiciona total_fiado e last_order_at na view de saldo do fiado — usados
-- pela aba "Clientes" pra ordenar por quem mais consome e detectar quem
-- está inativo (sem compra recente). CREATE OR REPLACE VIEW não garante
-- manter security_invoker, então reaplica explicitamente.

CREATE OR REPLACE VIEW public.pdv_customer_balances AS
SELECT
  c.id AS customer_id,
  c.store_id,
  c.name,
  c.phone,
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
