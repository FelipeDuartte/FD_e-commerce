BEGIN;

-- Pedido fiado criado com produtos direto na aba Clientes (ver
-- NewFiadoOrderModal) não pode baixar estoque na hora — o dono só quer
-- reservar o que foi "vendido" na conta do cliente, e só descontar do
-- estoque de verdade quando o cliente de fato pagar. stock_pending marca
-- pedidos nessa situação; reaproveitada também pelo fluxo de cartão
-- online via Mercado Pago (skipStockDecrement), que já tinha exatamente
-- essa mesma necessidade — estoque só baixa quando o pagamento é aprovado.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stock_pending boolean NOT NULL DEFAULT false;

-- ── restore_stock: não devolve o que nunca foi tirado ──────────────────
-- Pedido com stock_pending ainda true nunca baixou estoque nenhum — se
-- restore_stock rodasse do jeito antigo, ADICIONARIA estoque que nunca
-- saiu (ex: cancelar um pedido fiado que ainda não foi pago).
CREATE OR REPLACE FUNCTION public.restore_stock(p_order_id uuid, p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  item            record;
  v_pack          record;
  v_target_id     text;
  v_qty           int;
  v_stock_pending boolean;
begin
  select stock_pending into v_stock_pending
    from public.orders
   where id = p_order_id and store_id = p_store_id;

  if v_stock_pending then
    return jsonb_build_object('success', true);
  end if;

  for item in
    select product_id, name, quantity
      from public.order_items
     where order_id = p_order_id
  loop
    select pack_of_product_id, pack_units
      into v_pack
      from public.products
     where store_id = p_store_id
       and id = item.product_id;

    if v_pack.pack_of_product_id is not null then
      v_target_id := v_pack.pack_of_product_id;
      v_qty       := item.quantity * v_pack.pack_units;
    else
      v_target_id := item.product_id;
      v_qty       := item.quantity;
    end if;

    update public.products
       set stock = stock + v_qty,
           is_active = true
     where store_id = p_store_id
       and id = v_target_id;

    insert into public.stock_movements (store_id, product_id, product_name, quantity, reason, order_id)
    values (p_store_id, v_target_id, item.name, v_qty, 'cancelamento', p_order_id);

    perform public.sync_pack_stock(p_store_id, v_target_id);

  end loop;

  return jsonb_build_object('success', true);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;

-- ── confirm_mercadopago_payment: marca settled também aqui ─────────────
-- Precisa zerar stock_pending quando de fato baixa o estoque na aprovação
-- do pagamento — senão um cancelamento posterior desse pedido cairia no
-- guard novo do restore_stock achando (errado) que nada foi baixado.
CREATE OR REPLACE FUNCTION public.confirm_mercadopago_payment(
  p_order_id uuid, p_store_id uuid, p_payment_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_claimed      uuid;
  v_order_status text;
  item           record;
  v_pack         record;
  v_target_id    text;
  v_qty          int;
begin
  update public.orders
     set payment_status = 'pago',
         payment_reference = p_payment_id
   where id = p_order_id
     and store_id = p_store_id
     and payment_status <> 'pago'
  returning id, status into v_claimed, v_order_status;

  if v_claimed is null then
    return jsonb_build_object('success', true, 'stock_decremented', false);
  end if;

  if v_order_status in ('cancelled', 'rejected') then
    return jsonb_build_object('success', true, 'stock_decremented', false, 'order_already_terminal', true);
  end if;

  for item in
    select oi.product_id, oi.name, oi.quantity
      from public.order_items oi
     where oi.order_id = p_order_id
  loop
    select pack_of_product_id, pack_units
      into v_pack
      from public.products
     where store_id = p_store_id
       and id = item.product_id;

    if v_pack.pack_of_product_id is not null then
      v_target_id := v_pack.pack_of_product_id;
      v_qty       := item.quantity * v_pack.pack_units;
    else
      v_target_id := item.product_id;
      v_qty       := item.quantity;
    end if;

    update public.products
       set stock = greatest(0, stock - v_qty),
           is_active = case when stock - v_qty <= 0 then false else is_active end
     where store_id = p_store_id
       and id = v_target_id;

    insert into public.stock_movements (store_id, product_id, product_name, quantity, reason, order_id)
    values (p_store_id, v_target_id, item.name, -v_qty, 'venda', p_order_id);

    perform public.sync_pack_stock(p_store_id, v_target_id);
  end loop;

  update public.orders set stock_pending = false where id = p_order_id;

  return jsonb_build_object('success', true, 'stock_decremented', true);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;

-- ── remove_pdv_sale_item: não devolve o que nunca foi tirado ───────────
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

  select id, store_id, status, channel, payment_method, total, stock_pending
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

  -- Pedido ainda não baixou estoque nenhum (stock_pending) — não tem o que
  -- devolver, só tira o item do pedido mesmo.
  if not v_order.stock_pending then
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
  end if;

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

-- ── settle_fiado_stock: baixa estoque dos pedidos que acabaram de ficar
-- "pagos" (mesma ordem FIFO usada pro selo "Pago" no front — mais antigo
-- primeiro, pedidos fiado + lançamentos livres juntos). Chamada depois de
-- registrar um pagamento OU de criar um pedido novo (cobre o caso do
-- cliente já ter crédito suficiente pra cobrir o pedido na hora). Nunca
-- bloqueia por falta de estoque (greatest(0, ...), mesmo padrão do
-- confirm_mercadopago_payment) — o cliente já pagou, não dá pra "recusar"
-- aqui; estoque negativo vira conferência manual do admin.
CREATE OR REPLACE FUNCTION public.settle_fiado_stock(p_store_id uuid, p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_total_paid numeric;
  v_remaining  numeric;
  v_debt       record;
  v_pending    boolean;
  v_item       record;
  v_pack       record;
  v_target_id  text;
  v_qty        int;
begin
  if not is_store_admin(p_store_id) then
    return jsonb_build_object('success', false, 'error', 'Sem permissão.');
  end if;

  select coalesce(sum(amount), 0) into v_total_paid
    from public.pdv_customer_payments
   where store_id = p_store_id and customer_id = p_customer_id;

  v_remaining := v_total_paid;

  for v_debt in
    select 'order'::text as kind, id, total as amount, created_at
      from public.orders
     where store_id = p_store_id and pdv_customer_id = p_customer_id
       and payment_method = 'fiado' and status <> 'cancelled'
    union all
    select 'charge'::text as kind, id, amount, created_at
      from public.pdv_customer_charges
     where store_id = p_store_id and customer_id = p_customer_id
    order by created_at asc
  loop
    exit when v_remaining < v_debt.amount - 0.005;
    v_remaining := v_remaining - v_debt.amount;

    if v_debt.kind <> 'order' then
      continue;
    end if;

    select stock_pending into v_pending from public.orders where id = v_debt.id;
    if not v_pending then
      continue;
    end if;

    for v_item in
      select product_id, name, quantity from public.order_items where order_id = v_debt.id
    loop
      select pack_of_product_id, pack_units into v_pack
        from public.products where store_id = p_store_id and id = v_item.product_id;

      if v_pack.pack_of_product_id is not null then
        v_target_id := v_pack.pack_of_product_id;
        v_qty       := v_item.quantity * v_pack.pack_units;
      else
        v_target_id := v_item.product_id;
        v_qty       := v_item.quantity;
      end if;

      update public.products
         set stock = greatest(0, stock - v_qty),
             is_active = case when stock - v_qty <= 0 then false else is_active end
       where store_id = p_store_id and id = v_target_id;

      insert into public.stock_movements (store_id, product_id, product_name, quantity, reason, order_id)
      values (p_store_id, v_target_id, v_item.name, -v_qty, 'venda', v_debt.id);

      perform public.sync_pack_stock(p_store_id, v_target_id);
    end loop;

    update public.orders set stock_pending = false where id = v_debt.id;
  end loop;

  return jsonb_build_object('success', true);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;

COMMIT;
