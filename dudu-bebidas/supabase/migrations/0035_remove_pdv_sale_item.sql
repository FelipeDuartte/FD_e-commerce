BEGIN;

-- Remove um item específico de uma venda "Em Aberto" (fiado) já registrada
-- — o dono reclamou que hoje só dá pra cancelar o pedido inteiro e lançar
-- tudo de novo quando erra em UM item só de um pedido fiado com vários
-- produtos (ex: 8 itens, errou só a quantidade de um). Só permite em
-- pedidos fiado: nenhum dinheiro mudou de mão ainda, é só uma dívida em
-- aberto — diferente de uma venda em dinheiro/cartão já fechada, onde
-- cancel_pdv_sale (a venda inteira) continua sendo o caminho certo.
-- Diferente de cancel_pdv_sale, NÃO exige o caixa que registrou a venda
-- estar aberto: pedido fiado é uma dívida que fica em aberto por dias/
-- semanas até o cliente pagar, então o dono precisa poder corrigir um item
-- mesmo depois do caixa daquele dia já ter fechado.
-- Devolve o estoque do item (mesma lógica de pack de restore_stock),
-- registra 'cancelamento' no histórico de estoque, remove a linha e reduz
-- orders.total. Se era o último item, cancela o pedido inteiro em vez de
-- deixar um pedido fiado vazio pendurado (pdv_customer_balances já ignora
-- pedidos cancelados, então a dívida do cliente cai certinho).
CREATE OR REPLACE FUNCTION public.remove_pdv_sale_item(p_order_id uuid, p_order_item_id uuid, p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_order           record;
  v_item            record;
  v_pack            record;
  v_target_id       text;
  v_qty             int;
  v_remaining_count int;
  v_new_total       numeric;
begin
  if not is_store_admin(p_store_id) then
    return jsonb_build_object('success', false, 'error', 'Sem permissão.');
  end if;

  select id, store_id, status, channel, payment_method, total
    into v_order
    from public.orders
   where id = p_order_id
   for update;

  if v_order.id is null then
    return jsonb_build_object('success', false, 'error', 'Venda não encontrada.');
  end if;

  if v_order.store_id <> p_store_id then
    return jsonb_build_object('success', false, 'error', 'Venda não pertence a esta loja.');
  end if;

  if v_order.channel <> 'balcao' then
    return jsonb_build_object('success', false, 'error', 'Só é possível remover item de vendas de balcão.');
  end if;

  if v_order.payment_method <> 'fiado' then
    return jsonb_build_object(
      'success', false,
      'error', 'Só é possível remover item de pedidos em aberto (fiado). Pra outras formas de pagamento, cancele a venda inteira.'
    );
  end if;

  if v_order.status = 'cancelled' then
    return jsonb_build_object('success', false, 'error', 'Essa venda já está cancelada.');
  end if;

  select id, product_id, name, quantity, price
    into v_item
    from public.order_items
   where id = p_order_item_id
     and order_id = p_order_id
   for update;

  if v_item.id is null then
    return jsonb_build_object('success', false, 'error', 'Item não encontrado nessa venda.');
  end if;

  select pack_of_product_id, pack_units
    into v_pack
    from public.products
   where store_id = p_store_id
     and id = v_item.product_id;

  if v_pack.pack_of_product_id is not null then
    v_target_id := v_pack.pack_of_product_id;
    v_qty       := v_item.quantity * v_pack.pack_units;
  else
    v_target_id := v_item.product_id;
    v_qty       := v_item.quantity;
  end if;

  update public.products
     set stock = stock + v_qty,
         is_active = true
   where store_id = p_store_id
     and id = v_target_id;

  insert into public.stock_movements (store_id, product_id, product_name, quantity, reason, order_id)
  values (p_store_id, v_target_id, v_item.name, v_qty, 'cancelamento', p_order_id);

  perform public.sync_pack_stock(p_store_id, v_target_id);

  delete from public.order_items where id = v_item.id;

  select count(*) into v_remaining_count from public.order_items where order_id = p_order_id;

  if v_remaining_count = 0 then
    update public.orders set status = 'cancelled', total = 0 where id = p_order_id;
    return jsonb_build_object('success', true, 'order_cancelled', true);
  end if;

  v_new_total := greatest(v_order.total - (v_item.price * v_item.quantity), 0);

  update public.orders set total = v_new_total where id = p_order_id;

  return jsonb_build_object('success', true, 'order_cancelled', false, 'new_total', v_new_total);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;

COMMIT;
