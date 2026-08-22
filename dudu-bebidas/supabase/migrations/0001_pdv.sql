-- ─────────────────────────────────────────────────────────────
-- PDV (venda de balcão) — sessão de caixa + origem do pedido
--
-- Primeira migration versionada do projeto. Rodar manualmente no
-- SQL Editor do Supabase (a conexão direta com Postgres está
-- bloqueada no ambiente onde isso foi gerado).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE public.cash_sessions (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id                  uuid NOT NULL REFERENCES public.stores(id),
  opened_by                 uuid NOT NULL REFERENCES auth.users(id),
  opened_at                 timestamptz NOT NULL DEFAULT now(),
  opening_amount            numeric(10,2) NOT NULL DEFAULT 0,
  closed_by                 uuid REFERENCES auth.users(id),
  closed_at                 timestamptz,
  closing_amount_declared   numeric(10,2),
  closing_amount_expected   numeric(10,2),
  status                    text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at                timestamptz NOT NULL DEFAULT now()
);

-- Só um caixa aberto por loja por vez, garantido no banco (não só na UI)
CREATE UNIQUE INDEX uq_cash_sessions_one_open_per_store
  ON public.cash_sessions (store_id)
  WHERE status = 'open';

ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de store_config/categories/products: só admin da própria
-- loja, nenhum acesso público (is_store_admin já existe no banco).
CREATE POLICY cash_sessions_admin_all ON public.cash_sessions
  FOR ALL TO authenticated
  USING (is_store_admin(store_id))
  WITH CHECK (is_store_admin(store_id));

ALTER TABLE public.orders
  ADD COLUMN channel text NOT NULL DEFAULT 'online'
    CHECK (channel IN ('online', 'balcao')),
  ADD COLUMN cash_session_id uuid REFERENCES public.cash_sessions(id),
  ADD COLUMN sold_by uuid REFERENCES auth.users(id);
-- user_id continua null pra venda de balcão (representa CONTA de cliente,
-- não operador — não mexe na policy orders_customer_read_own)

CREATE INDEX idx_orders_cash_session
  ON public.orders(cash_session_id) WHERE cash_session_id IS NOT NULL;

-- Fechamento de caixa: soma vendas em dinheiro da sessão, compara com o
-- valor contado, fecha. Mesmo padrão de cancel_order/process_order
-- (SECURITY DEFINER, retorno {success, error}).
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

  SELECT COALESCE(SUM(total), 0) INTO v_cash_sales
  FROM orders
  WHERE cash_session_id = p_session_id AND payment_method = 'cash';

  v_expected := v_session.opening_amount + v_cash_sales;

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
