-- ─────────────────────────────────────────────────────────────
-- close_cash_session somava TODA venda em dinheiro da sessão, mesmo as
-- já canceladas (cancel_pdv_sale só marca status = 'cancelled' e devolve
-- o estoque — nunca apagou a linha do pedido). Isso inflava o "Esperado"
-- no fechamento de caixa com vendas que não deveriam contar mais.
-- ─────────────────────────────────────────────────────────────

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
  WHERE cash_session_id = p_session_id
    AND payment_method = 'cash'
    AND status <> 'cancelled';

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
