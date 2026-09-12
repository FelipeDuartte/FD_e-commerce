BEGIN;

-- ─────────────────────────────────────────────────────────────
-- Fardo/caixa compartilhando estoque com o produto avulso — um produto
-- pode ser cadastrado como "fardo de X unidades" de outro produto já
-- existente (a base). O estoque de verdade mora só na base (em unidades
-- soltas); o `stock` do fardo vira um valor CALCULADO
-- (base.stock / pack_units, arredondado pra baixo), recalculado sempre
-- que a base muda. Vender/cancelar um fardo baixa/devolve a base, nunca
-- a própria linha do fardo.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.products
  ADD COLUMN pack_of_product_id text,
  ADD COLUMN pack_units integer,
  ADD CONSTRAINT products_pack_of_fkey
    FOREIGN KEY (pack_of_product_id, store_id) REFERENCES public.products(id, store_id),
  ADD CONSTRAINT products_pack_units_check
    CHECK ((pack_of_product_id IS NULL) = (pack_units IS NULL) AND (pack_units IS NULL OR pack_units >= 2));

-- ── sync_pack_stock: recalcula o estoque exibido nas duas direções ─────────
-- Chamado depois de QUALQUER mudança em products.stock (venda, cancelamento,
-- edição manual): se p_product_id for um fardo, recalcula ele a partir da
-- base; se for uma base, recalcula todo fardo que aponta pra ela. Exposta
-- pro client autenticado (cadastro no PDV chama direto via supabase.rpc),
-- por isso valida is_store_admin como as outras funções client-facing.
CREATE OR REPLACE FUNCTION public.sync_pack_stock(p_store_id uuid, p_product_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if not is_store_admin(p_store_id) then
    return jsonb_build_object('success', false, 'error', 'Acesso restrito a administradores de loja.');
  end if;

  update public.products p
     set stock = floor(base.stock::numeric / p.pack_units)::int,
         is_active = case
                       when floor(base.stock::numeric / p.pack_units) <= 0 then false
                       else p.is_active
                     end
    from public.products base
   where p.store_id = p_store_id
     and base.store_id = p_store_id
     and (
       (p.id = p_product_id and p.pack_of_product_id = base.id)
       or (base.id = p_product_id and p.pack_of_product_id = base.id)
     );

  return jsonb_build_object('success', true);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;

-- ── process_order: agora pack-aware ────────────────────────────────────────
-- Item de fardo: valida/baixa a BASE (pack_units × quantidade vendida), não
-- a própria linha do fardo. Item normal: comportamento idêntico a antes.
CREATE OR REPLACE FUNCTION public.process_order(p_store_id uuid, p_order_id uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
declare
  item        jsonb;
  v_product   record;
  v_base      record;
  v_target_id text;
  v_required  int;
  errors      text[] := '{}';
begin
  for item in select * from jsonb_array_elements(p_items)
  loop
    select id, name, stock, is_active, pack_of_product_id, pack_units
      into v_product
      from public.products
     where store_id = p_store_id
       and id = (item->>'product_id')::text
       for update;

    if not found then
      errors := array_append(errors,
        format('Produto %s não encontrado', item->>'product_id'));
      continue;
    end if;

    if not v_product.is_active then
      errors := array_append(errors,
        format('Produto "%s" não está disponível', v_product.name));
      continue;
    end if;

    if v_product.pack_of_product_id is not null then
      select id, name, stock
        into v_base
        from public.products
       where store_id = p_store_id
         and id = v_product.pack_of_product_id
         for update;

      v_target_id := v_base.id;
      v_required  := (item->>'quantity')::int * v_product.pack_units;

      if v_base.stock < v_required then
        errors := array_append(errors,
          format('Estoque insuficiente para "%s" (disponível: %s fardo(s))',
                 v_product.name, floor(v_base.stock::numeric / v_product.pack_units)));
        continue;
      end if;
    else
      v_target_id := v_product.id;
      v_required  := (item->>'quantity')::int;

      if v_product.stock < v_required then
        errors := array_append(errors,
          format('Estoque insuficiente para "%s" (disponível: %s)',
                 v_product.name, v_product.stock));
        continue;
      end if;
    end if;

    update public.products
       set stock = stock - v_required,
           is_active = case
                         when stock - v_required <= 0 then false
                         else true
                       end
     where store_id = p_store_id
       and id = v_target_id;

    insert into public.stock_movements (store_id, product_id, product_name, quantity, reason, order_id)
    values (p_store_id, v_target_id, v_product.name, -v_required, 'venda', p_order_id);

    perform public.sync_pack_stock(p_store_id, v_target_id);

  end loop;

  if array_length(errors, 1) > 0 then
    raise exception 'ORDER_ERRORS: %', array_to_string(errors, ' | ');
  end if;

  return jsonb_build_object('success', true, 'order_id', p_order_id);

exception when others then
  return jsonb_build_object(
    'success', false,
    'error',   sqlerrm
  );
end;
$function$;

-- ── restore_stock: devolve pra base quando o item cancelado era um fardo ───
CREATE OR REPLACE FUNCTION public.restore_stock(p_order_id uuid, p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  item        record;
  v_pack      record;
  v_target_id text;
  v_qty       int;
begin
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

-- ── confirm_mercadopago_payment: mesma lógica pack-aware ───────────────────
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

  return jsonb_build_object('success', true, 'stock_decremented', true);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;

COMMIT;
