BEGIN;

-- ─────────────────────────────────────────────────────────────
-- Fiado (conta de cliente) no PDV — venda registrada na hora (baixa
-- estoque normalmente), mas sem cobrança imediata; fica como dívida do
-- cliente até ele vir pagar. Diferente de order_payments (0011): aqui não
-- é "uma venda paga em várias formas", é "uma venda não paga ainda".
-- ─────────────────────────────────────────────────────────────

CREATE TABLE public.pdv_customers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   uuid NOT NULL REFERENCES public.stores(id),
  name       text NOT NULL,
  phone      text,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pdv_customers_store_name ON public.pdv_customers(store_id, name);

ALTER TABLE public.pdv_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY pdv_customers_admin_all ON public.pdv_customers
  FOR ALL TO authenticated
  USING (is_store_admin(store_id))
  WITH CHECK (is_store_admin(store_id));

-- Pagamento que abate a dívida do cliente — não é uma venda (sem
-- cartItems/estoque), só entrada de dinheiro/outro método quitando fiado
-- acumulado. cash_session_id fica preenchido quando recebido com o caixa
-- aberto, pra entrar na conferência (ver close_cash_session abaixo).
CREATE TABLE public.pdv_customer_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid NOT NULL REFERENCES public.stores(id),
  customer_id     uuid NOT NULL REFERENCES public.pdv_customers(id),
  amount          numeric NOT NULL CHECK (amount > 0),
  payment_method  text NOT NULL,
  cash_session_id uuid REFERENCES public.cash_sessions(id),
  received_by     uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pdv_customer_payments_customer ON public.pdv_customer_payments(customer_id);

ALTER TABLE public.pdv_customer_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY pdv_customer_payments_admin_all ON public.pdv_customer_payments
  FOR ALL TO authenticated
  USING (is_store_admin(store_id))
  WITH CHECK (is_store_admin(store_id));

-- Liga a venda ao cliente do fiado — null pra toda venda que não é fiado
-- (a grande maioria), então não afeta nada do que já existe.
ALTER TABLE public.orders ADD COLUMN pdv_customer_id uuid REFERENCES public.pdv_customers(id);

-- Saldo devedor = soma das vendas 'fiado' não canceladas menos soma dos
-- pagamentos recebidos. View simples (sem SECURITY DEFINER) — herda a RLS
-- das tabelas de baixo, então só admin da própria loja enxerga linha
-- alguma (orders/pdv_customers/pdv_customer_payments já são admin-only).
CREATE VIEW public.pdv_customer_balances AS
SELECT
  c.id AS customer_id,
  c.store_id,
  c.name,
  c.phone,
  COALESCE(o.total_fiado, 0) AS total_fiado,
  COALESCE(p.total_paid, 0) AS total_paid,
  COALESCE(o.total_fiado, 0) - COALESCE(p.total_paid, 0) AS balance
FROM public.pdv_customers c
LEFT JOIN (
  SELECT pdv_customer_id, SUM(total) AS total_fiado
  FROM public.orders
  WHERE payment_method = 'fiado' AND status <> 'cancelled'
  GROUP BY pdv_customer_id
) o ON o.pdv_customer_id = c.id
LEFT JOIN (
  SELECT customer_id, SUM(amount) AS total_paid
  FROM public.pdv_customer_payments
  GROUP BY customer_id
) p ON p.customer_id = c.id;

-- close_cash_session: pagamento de fiado recebido EM DINHEIRO durante essa
-- sessão é dinheiro de verdade entrando no caixa agora, mesmo que a venda
-- original (a dívida) tenha sido registrada em outra sessão/dia — precisa
-- somar na conferência. A venda 'fiado' em si NUNCA soma (não gerou
-- dinheiro nenhum na hora, só uma dívida).
CREATE OR REPLACE FUNCTION public.close_cash_session(
  p_session_id uuid,
  p_declared_amount numeric
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session cash_sessions%ROWTYPE;
  v_cash_sales numeric;
  v_cash_fiado_payments numeric;
  v_expected numeric;
BEGIN
  SELECT * INTO v_session FROM cash_sessions WHERE id = p_session_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Caixa não encontrado.');
  END IF;

  IF NOT is_store_admin(v_session.store_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão.');
  END IF;

  IF v_session.status <> 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Caixa já está fechado.');
  END IF;

  SELECT COALESCE(SUM(
    CASE
      WHEN o.payment_method = 'cash' THEN o.total
      WHEN o.payment_method = 'misto' THEN COALESCE(
        (SELECT SUM(op.amount) FROM public.order_payments op WHERE op.order_id = o.id AND op.method = 'cash'),
        0
      )
      ELSE 0
    END
  ), 0) INTO v_cash_sales
  FROM public.orders o
  WHERE o.cash_session_id = p_session_id
    AND o.status <> 'cancelled'
    AND o.payment_method IN ('cash', 'misto');

  SELECT COALESCE(SUM(amount), 0) INTO v_cash_fiado_payments
  FROM public.pdv_customer_payments
  WHERE cash_session_id = p_session_id AND payment_method = 'cash';

  v_expected := v_session.opening_amount + v_cash_sales + v_cash_fiado_payments;

  UPDATE cash_sessions
  SET status = 'closed',
      closed_by = auth.uid(),
      closed_at = now(),
      closing_amount_declared = p_declared_amount,
      closing_amount_expected = v_expected
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'expected', v_expected,
    'declared', p_declared_amount,
    'difference', p_declared_amount - v_expected
  );
END;
$$;

COMMIT;
