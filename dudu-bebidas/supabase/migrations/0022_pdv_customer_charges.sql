BEGIN;

-- Pedido em aberto lançado manualmente na aba Clientes — mesma ideia de
-- pdv_customer_payments (0012), só que aumentando a dívida em vez de
-- abater. Não passa por orders/order_items de propósito: é um lançamento
-- livre (valor + descrição), sem produto/estoque envolvido.
CREATE TABLE public.pdv_customer_charges (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid NOT NULL REFERENCES public.stores(id),
  customer_id     uuid NOT NULL REFERENCES public.pdv_customers(id),
  amount          numeric NOT NULL CHECK (amount > 0),
  description     text NOT NULL,
  cash_session_id uuid REFERENCES public.cash_sessions(id),
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pdv_customer_charges_customer ON public.pdv_customer_charges(customer_id);

ALTER TABLE public.pdv_customer_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY pdv_customer_charges_admin_all ON public.pdv_customer_charges
  FOR ALL TO authenticated
  USING (is_store_admin(store_id))
  WITH CHECK (is_store_admin(store_id));

-- pdv_customer_balances: total_fiado passa a somar também esses
-- lançamentos manuais, além das vendas 'fiado' de verdade — pro dono é a
-- mesma coisa (dívida do cliente), só a origem é diferente.
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
  COALESCE(o.total_fiado, 0) + COALESCE(ch.total_charges, 0) AS total_fiado,
  COALESCE(p.total_paid, 0) AS total_paid,
  (COALESCE(o.total_fiado, 0) + COALESCE(ch.total_charges, 0)) - COALESCE(p.total_paid, 0) AS balance,
  GREATEST(o.last_order_at, ch.last_charge_at) AS last_order_at
FROM public.pdv_customers c
LEFT JOIN (
  SELECT pdv_customer_id, SUM(total) AS total_fiado, MAX(created_at) AS last_order_at
  FROM public.orders
  WHERE payment_method = 'fiado' AND status <> 'cancelled'
  GROUP BY pdv_customer_id
) o ON o.pdv_customer_id = c.id
LEFT JOIN (
  SELECT customer_id, SUM(amount) AS total_charges, MAX(created_at) AS last_charge_at
  FROM public.pdv_customer_charges
  GROUP BY customer_id
) ch ON ch.customer_id = c.id
LEFT JOIN (
  SELECT customer_id, SUM(amount) AS total_paid
  FROM public.pdv_customer_payments
  GROUP BY customer_id
) p ON p.customer_id = c.id;

ALTER VIEW public.pdv_customer_balances SET (security_invoker = true);

COMMIT;
