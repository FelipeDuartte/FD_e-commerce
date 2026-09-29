BEGIN;

-- Desfaz uma compra registrada errada (produto errado, quantidade errada,
-- etc.) sem precisar mexer direto no banco — o dono relatou ter errado o
-- produto ao registrar uma compra e precisar de ajuda toda vez. Só permite
-- desfazer a compra MAIS RECENTE de um produto (evita a bagunça de
-- recalcular estoque/custo se já rolou venda ou outra compra depois dela).
-- Devolve o estoque, restaura o custo pro valor da compra anterior (ou
-- null se era a primeira), e remove o registro — é correção de erro de
-- digitação, não um evento real que precise ficar no histórico (diferente
-- de venda cancelada, que representa algo que de fato aconteceu).
CREATE OR REPLACE FUNCTION public.undo_last_product_purchase(p_store_id uuid, p_movement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_movement record;
  v_latest_id uuid;
  v_prev_cost numeric;
begin
  if not is_store_admin(p_store_id) then
    return jsonb_build_object('success', false, 'error', 'Acesso restrito a administradores de loja.');
  end if;

  select id, product_id, product_name, quantity, reason
    into v_movement
    from public.stock_movements
   where id = p_movement_id and store_id = p_store_id
   for update;

  if v_movement.id is null then
    return jsonb_build_object('success', false, 'error', 'Movimentação não encontrada.');
  end if;

  if v_movement.reason <> 'compra' then
    return jsonb_build_object('success', false, 'error', 'Só é possível desfazer uma compra.');
  end if;

  select id into v_latest_id
    from public.stock_movements
   where store_id = p_store_id and product_id = v_movement.product_id and reason = 'compra'
   order by created_at desc
   limit 1;

  if v_latest_id is distinct from v_movement.id then
    return jsonb_build_object(
      'success', false,
      'error', 'Só dá pra desfazer a compra mais recente desse produto — já tem movimentação depois dela.'
    );
  end if;

  select unit_cost into v_prev_cost
    from public.stock_movements
   where store_id = p_store_id and product_id = v_movement.product_id and reason = 'compra' and id <> v_movement.id
   order by created_at desc
   limit 1;

  update public.products
     set stock = stock - v_movement.quantity,
         cost_price = v_prev_cost
   where store_id = p_store_id and id = v_movement.product_id;

  delete from public.stock_movements where id = v_movement.id;

  perform public.sync_pack_stock(p_store_id, v_movement.product_id);

  return jsonb_build_object(
    'success', true,
    'product_name', v_movement.product_name,
    'quantity', v_movement.quantity
  );
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;

COMMIT;
