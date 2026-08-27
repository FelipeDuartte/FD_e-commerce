BEGIN;

-- ─────────────────────────────────────────────────────────────
-- Pagamento dividido no PDV (ex: parte em dinheiro, parte no cartão) —
-- orders.payment_method vira 'misto' quando a venda foi paga em mais de
-- uma forma, e o detalhamento (qual forma, quanto) fica aqui. Só o
-- servidor (service role, dentro de fulfillOrder) escreve nessa tabela —
-- os valores nunca vêm confiados do client, mesmo padrão do total do pedido.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE public.order_payments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id   uuid NOT NULL REFERENCES public.stores(id),
  method     text NOT NULL,
  amount     numeric NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_payments_order_id ON public.order_payments(order_id);

ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de stock_movements: só admin da própria loja lê, nenhum
-- acesso público. Insert só acontece via service role (bypassa RLS), então
-- não existe policy de INSERT pra authenticated aqui de propósito.
CREATE POLICY order_payments_admin_select ON public.order_payments
  FOR SELECT TO authenticated
  USING (is_store_admin(store_id));

-- close_cash_session somava só orders.total de payment_method = 'cash' —
-- agora uma venda 'misto' também pode ter uma parte em dinheiro, que
-- precisa entrar na conferência do caixa (a parte em cartão/pix, não).
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

COMMIT;
