BEGIN;

-- Guarda quando o pedido virou "on_the_way" de verdade — sem isso não dá
-- pra saber há quanto tempo o entregador está "em entrega" (orders só tem
-- created_at, que é de quando o pedido foi feito, não de quando saiu pra
-- entrega). Usado só pra cortar o compartilhamento de localização depois
-- de um tempo, se o admin esquecer de marcar como entregue (ver
-- useLocationSharing.js) — nunca muda o status sozinho.
ALTER TABLE public.orders ADD COLUMN on_the_way_at timestamptz;

CREATE OR REPLACE FUNCTION public.courier_advance_order_status(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_courier_id uuid;
  v_order record;
  v_next text;
begin
  select id into v_courier_id from public.couriers where user_id = auth.uid() and is_active;

  if v_courier_id is null then
    return jsonb_build_object('success', false, 'error', 'Você não está cadastrado como entregador.');
  end if;

  select id, status, courier_id into v_order
    from public.orders
   where id = p_order_id
   for update;

  if v_order.id is null or v_order.courier_id is distinct from v_courier_id then
    return jsonb_build_object('success', false, 'error', 'Pedido não encontrado ou não atribuído a você.');
  end if;

  v_next := case v_order.status
    when 'preparing'  then 'on_the_way'
    when 'on_the_way' then 'delivered'
    else null
  end;

  if v_next is null then
    return jsonb_build_object('success', false, 'error', 'Esse pedido não pode avançar de status agora.');
  end if;

  update public.orders
     set status = v_next,
         on_the_way_at = case when v_next = 'on_the_way' then now() else on_the_way_at end
   where id = p_order_id;

  return jsonb_build_object('success', true, 'status', v_next);
end;
$function$;

-- get_order_status devolve também quando foi a última atualização de
-- localização do entregador — o cliente usa isso pra saber se o pino no
-- mapa é recente ou se ficou desatualizado (app fechado, sem sinal, ou
-- pedido esquecido em "em entrega").
CREATE OR REPLACE FUNCTION public.get_order_status(p_order_id uuid, p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_order record;
  v_courier_lat numeric;
  v_courier_lng numeric;
  v_courier_location_updated_at timestamptz;
begin
  select status, payment_status, payment_method, customer_claimed_paid_at,
         courier_name, courier_phone, courier_id, delivery_lat, delivery_lng
    into v_order
    from public.orders
   where id = p_order_id
     and store_id = p_store_id;

  if v_order.status is null then
    return jsonb_build_object('success', false, 'error', 'Pedido não encontrado.');
  end if;

  if v_order.courier_id is not null then
    select lat, lng, updated_at into v_courier_lat, v_courier_lng, v_courier_location_updated_at
      from public.courier_locations where courier_id = v_order.courier_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'status', v_order.status,
    'payment_status', v_order.payment_status,
    'payment_method', v_order.payment_method,
    'customer_claimed_paid_at', v_order.customer_claimed_paid_at,
    'courier_name', v_order.courier_name,
    'courier_phone', v_order.courier_phone,
    'delivery_lat', v_order.delivery_lat,
    'delivery_lng', v_order.delivery_lng,
    'courier_lat', v_courier_lat,
    'courier_lng', v_courier_lng,
    'courier_location_updated_at', v_courier_location_updated_at
  );
end;
$function$;

COMMIT;
