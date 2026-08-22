-- ─────────────────────────────────────────────────────────────
-- Cancelamento de venda de balcão (PDV) — devolve estoque, só
-- permitido enquanto o caixa daquela venda ainda está aberto (evita
-- bagunçar a conciliação de um caixa já fechado). Mesmo padrão de
-- cancel_order (SECURITY DEFINER, retorno {success, error}),
-- reaproveita restore_stock que já existe.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cancel_pdv_sale(p_order_id uuid, p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order   record;
  v_session record;
  v_result  jsonb;
BEGIN
  IF NOT is_store_admin(p_store_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão.');
  END IF;

  SELECT id, store_id, status, channel, cash_session_id
    INTO v_order
    FROM public.orders
   WHERE id = p_order_id;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Venda não encontrada.');
  END IF;

  IF v_order.store_id <> p_store_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Venda não pertence a esta loja.');
  END IF;

  IF v_order.channel <> 'balcao' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Só é possível cancelar vendas de balcão por aqui.');
  END IF;

  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Essa venda já está cancelada.');
  END IF;

  SELECT status INTO v_session
    FROM public.cash_sessions
   WHERE id = v_order.cash_session_id;

  IF v_session.status IS DISTINCT FROM 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'O caixa dessa venda já foi fechado — não é mais possível cancelar.');
  END IF;

  SELECT public.restore_stock(p_order_id, p_store_id) INTO v_result;

  IF (v_result->>'success')::boolean IS FALSE THEN
    RETURN jsonb_build_object('success', false, 'error', v_result->>'error');
  END IF;

  UPDATE public.orders
     SET status = 'cancelled'
   WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', sqlerrm);
END;
$function$;
