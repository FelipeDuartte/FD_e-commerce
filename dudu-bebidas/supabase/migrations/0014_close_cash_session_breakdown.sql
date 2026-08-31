-- ─────────────────────────────────────────────────────────────
-- Fechamento de caixa por forma de pagamento — além do "Esperado" (só
-- dinheiro), devolve quanto entrou em cada forma na sessão. Vendas
-- 'misto' são explodidas pelas linhas de order_payments (a parte em
-- dinheiro de uma venda dividida cai no bucket "cash", a parte no cartão
-- cai em "credit_card" etc.), e pagamento de fiado recebido durante a
-- sessão soma no bucket da forma usada pra pagar (dinheiro real entrando
-- agora, mesmo que a dívida seja de outro dia). Venda 'fiado' em si entra
-- só como informação à parte (fiado_total) — não é dinheiro recebido.
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
  v_cash_fiado_payments numeric;
  v_expected numeric;
  v_breakdown jsonb;
  v_fiado_total numeric;
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

  SELECT COALESCE(jsonb_agg(jsonb_build_object('method', method, 'amount', amount) ORDER BY amount DESC), '[]'::jsonb)
    INTO v_breakdown
  FROM (
    SELECT method, SUM(amount) AS amount
    FROM (
      SELECT payment_method AS method, total AS amount
      FROM public.orders
      WHERE cash_session_id = p_session_id
        AND status <> 'cancelled'
        AND payment_method NOT IN ('misto', 'fiado')

      UNION ALL

      SELECT op.method, op.amount
      FROM public.orders o
      JOIN public.order_payments op ON op.order_id = o.id
      WHERE o.cash_session_id = p_session_id
        AND o.status <> 'cancelled'
        AND o.payment_method = 'misto'

      UNION ALL

      SELECT payment_method AS method, amount
      FROM public.pdv_customer_payments
      WHERE cash_session_id = p_session_id
    ) contributions
    GROUP BY method
  ) totals;

  SELECT COALESCE(SUM(total), 0) INTO v_fiado_total
  FROM public.orders
  WHERE cash_session_id = p_session_id AND status <> 'cancelled' AND payment_method = 'fiado';

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
    'difference', p_declared_amount - v_expected,
    'breakdown', v_breakdown,
    'fiado_total', v_fiado_total
  );
END;
$$;
