BEGIN;

-- Rastreamento de entrega — Fase 1 (operacional, sem mapa/localização).
-- Entregador é um papel NOVO, isolado de profiles/is_admin: nunca setamos
-- profiles.is_admin = true pra um entregador, porque isso daria acesso
-- total de admin (inclusive ao PDV desktop, que usa esse mesmo flag). A
-- identidade do entregador resolve inteiramente por esta tabela nova, via
-- user_id = auth.uid() — nunca via profiles.
CREATE TABLE public.couriers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   uuid NOT NULL REFERENCES public.stores(id),
  user_id    uuid REFERENCES auth.users(id),
  name       text NOT NULL,
  phone      text,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_couriers_store ON public.couriers(store_id);

ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de pdv_customers/stock_movements: admin da própria loja, tudo.
CREATE POLICY couriers_admin_all ON public.couriers
  FOR ALL TO authenticated
  USING (is_store_admin(store_id))
  WITH CHECK (is_store_admin(store_id));

-- Entregador lê a própria linha (resolve identidade/loja no app dele).
CREATE POLICY couriers_self_read ON public.couriers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Pedido ganha atribuição de entregador — colunas nullable, mesmo padrão de
-- sold_by/pdv_customer_id. Nome/telefone DENORMALIZADOS na hora da
-- atribuição (mesma lógica de stock_movements.product_name: evita abrir
-- RLS de couriers pro cliente só pra ele ver quem tá entregando).
ALTER TABLE public.orders ADD COLUMN courier_id uuid REFERENCES public.couriers(id);
ALTER TABLE public.orders ADD COLUMN courier_name text;
ALTER TABLE public.orders ADD COLUMN courier_phone text;

-- Entregador só lê os PRÓPRIOS pedidos atribuídos, e só enquanto estiver
-- ativo — policy adicional, somada (OR) às policies de admin/cliente que
-- já existem em orders. Desativar o entregador corta o acesso na hora,
-- não só impede receber pedido novo.
CREATE POLICY orders_courier_read_assigned ON public.orders
  FOR SELECT TO authenticated
  USING (courier_id IN (SELECT id FROM public.couriers WHERE user_id = auth.uid() AND is_active));

-- Entregador avança o próprio pedido (preparing→on_the_way→delivered) só
-- por esta RPC — nunca por update livre como o admin faz hoje, porque é um
-- papel novo/menos confiável e a transição precisa ser validada (sem pular
-- etapa, sem mexer em pedido de outro entregador).
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

  update public.orders set status = v_next where id = p_order_id;

  return jsonb_build_object('success', true, 'status', v_next);
end;
$function$;

-- get_order_status (definida em 0006_payment_status.sql) passa a devolver
-- também o entregador atribuído, pra confirmação do cliente mostrar quem
-- tá entregando. Corpo idêntico ao anterior + courier_name/courier_phone.
CREATE OR REPLACE FUNCTION public.get_order_status(p_order_id uuid, p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_order record;
begin
  select status, payment_status, payment_method, customer_claimed_paid_at, courier_name, courier_phone
    into v_order
    from public.orders
   where id = p_order_id
     and store_id = p_store_id;

  if v_order.status is null then
    return jsonb_build_object('success', false, 'error', 'Pedido não encontrado.');
  end if;

  return jsonb_build_object(
    'success', true,
    'status', v_order.status,
    'payment_status', v_order.payment_status,
    'payment_method', v_order.payment_method,
    'customer_claimed_paid_at', v_order.customer_claimed_paid_at,
    'courier_name', v_order.courier_name,
    'courier_phone', v_order.courier_phone
  );
end;
$function$;

COMMIT;
