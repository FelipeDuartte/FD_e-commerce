BEGIN;

-- ─────────────────────────────────────────────────────────────
-- Cartão online recusado pelo banco não deve deixar rastro nenhum —
-- nem escondido do admin (como a Fase 2 fazia até agora), apagado de
-- verdade. O pedido só existia porque fulfillOrder insere ANTES de
-- cobrar o cartão (pra não perder o rastro se a própria chamada à API
-- do MP falhar) — mas se a resposta vier "rejected"/"cancelled", não
-- há motivo pra manter a linha.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_rejected_mercadopago_order(p_order_id uuid, p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_order record;
begin
  select payment_provider, payment_status into v_order
    from public.orders
   where id = p_order_id
     and store_id = p_store_id;

  if v_order is null then
    -- Já não existe (chamada duplicada, ou já foi apagado antes) — sem erro.
    return jsonb_build_object('success', true, 'deleted', false);
  end if;

  -- Nunca apaga um pedido que já foi pago — protege contra o webhook
  -- entregar um evento de recusa fora de ordem depois de uma aprovação já
  -- ter chegado (mesma corrida rara que confirm_mercadopago_payment já
  -- trata do lado do estoque). Também restrito a pedidos do Mercado Pago —
  -- essa função nunca deveria mexer em pix/dinheiro/cartão na entrega.
  if v_order.payment_provider is distinct from 'mercadopago' or v_order.payment_status = 'pago' then
    return jsonb_build_object('success', false, 'error', 'Pedido não elegível para exclusão.');
  end if;

  delete from public.stock_movements where order_id = p_order_id;
  delete from public.order_items where order_id = p_order_id;
  delete from public.orders where id = p_order_id;

  return jsonb_build_object('success', true, 'deleted', true);
end;
$function$;

COMMIT;
