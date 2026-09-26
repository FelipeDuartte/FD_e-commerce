BEGIN;

-- Rastreamento de entrega — Fase 2 (localização ao vivo + mapa). Polling,
-- não Realtime/WebSocket: 1 linha por entregador, sempre sobrescrita
-- (upsert) — nunca cresce, sem conexão aberta o tempo todo.
CREATE TABLE public.courier_locations (
  courier_id uuid PRIMARY KEY REFERENCES public.couriers(id) ON DELETE CASCADE,
  lat        numeric(9,6) NOT NULL,
  lng        numeric(9,6) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.courier_locations ENABLE ROW LEVEL SECURITY;

-- Admin vê a localização de qualquer entregador da própria loja (mapa geral).
CREATE POLICY courier_locations_admin_read ON public.courier_locations
  FOR SELECT TO authenticated
  USING (courier_id IN (SELECT id FROM public.couriers WHERE is_store_admin(store_id)));

-- Entregador NUNCA escreve direto (sem policy de INSERT/UPDATE pra ele) —
-- só via esta RPC (SECURITY DEFINER, valida identidade e faz o upsert),
-- mesmo padrão de courier_advance_order_status: papel novo, escrita
-- sempre validada, nunca update livre do client.
CREATE OR REPLACE FUNCTION public.upsert_courier_location(p_lat numeric, p_lng numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_courier_id uuid;
begin
  select id into v_courier_id from public.couriers where user_id = auth.uid() and is_active;

  if v_courier_id is null then
    return jsonb_build_object('success', false, 'error', 'Você não está cadastrado como entregador.');
  end if;

  if p_lat is null or p_lng is null then
    return jsonb_build_object('success', false, 'error', 'Localização inválida.');
  end if;

  insert into public.courier_locations (courier_id, lat, lng, updated_at)
  values (v_courier_id, p_lat, p_lng, now())
  on conflict (courier_id) do update set lat = excluded.lat, lng = excluded.lng, updated_at = now();

  return jsonb_build_object('success', true);
end;
$function$;

-- Destino geocodificado uma única vez, no momento da atribuição do
-- entregador (feito no client, ver adminOrderService.js) — cacheado aqui
-- pra nunca precisar geocodificar de novo o mesmo pedido.
ALTER TABLE public.orders ADD COLUMN delivery_lat numeric(9,6);
ALTER TABLE public.orders ADD COLUMN delivery_lng numeric(9,6);

-- Aprendido na Fase 1: o GRANT de UPDATE em orders é por coluna neste
-- projeto — sem isso, o admin toma 403 ao tentar salvar essas colunas novas.
GRANT UPDATE (delivery_lat, delivery_lng) ON public.orders TO authenticated;

-- get_order_status (0006, estendida em 0030) devolve também a posição do
-- entregador e o destino — Confirm.jsx desenha o mapa sem precisar de
-- SELECT direto em couriers/courier_locations (que continuam fechadas
-- pro cliente/anônimo).
CREATE OR REPLACE FUNCTION public.get_order_status(p_order_id uuid, p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_order record;
  -- Variáveis escalares, não "record" — um record nunca atribuído (pedido
  -- sem entregador ainda) quebra a função ao ler qualquer campo dele;
  -- escalar não atribuído é só NULL, sem erro.
  v_courier_lat numeric;
  v_courier_lng numeric;
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
    select lat, lng into v_courier_lat, v_courier_lng
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
    'courier_lng', v_courier_lng
  );
end;
$function$;

COMMIT;
