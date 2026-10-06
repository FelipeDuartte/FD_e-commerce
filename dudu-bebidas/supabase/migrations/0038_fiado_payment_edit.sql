BEGIN;

-- Pedido criado com baixa de estoque adiada (NewFiadoOrderModal). Marca
-- esses pedidos pra que, se um pagamento for apagado/diminuído, só eles
-- tenham o estoque devolvido — pedidos normais já baixaram na criação.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stock_deferred boolean NOT NULL DEFAULT false;
UPDATE public.orders SET stock_deferred = true WHERE payment_method = 'fiado' AND stock_pending = true;

-- Sem isso, DELETE em pdv_customer_payments não chega pros outros
-- terminais (o filtro por cliente precisa dos dados antigos da linha).
ALTER TABLE public.pdv_customer_payments REPLICA IDENTITY FULL;

-- ── settle_fiado_stock: agora nos dois sentidos ─────────────────────────
-- Mesma ordem FIFO do selo "Pago". Pedido com baixa adiada que ficou
-- coberto → baixa estoque. Pedido que deixou de estar coberto (pagamento
-- apagado/diminuído) → devolve o estoque e volta a ficar pendente.
CREATE OR REPLACE FUNCTION public.settle_fiado_stock(p_store_id uuid, p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_total_paid numeric;
  v_remaining  numeric;
  v_still_paid boolean := true;
  v_covered    boolean;
  v_debt       record;
  v_order      record;
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
    if v_still_paid and v_remaining >= v_debt.amount - 0.005 then
      v_remaining := v_remaining - v_debt.amount;
      v_covered := true;
    else
      v_still_paid := false;
      v_covered := false;
    end if;

    if v_debt.kind <> 'order' then
      continue;
    end if;

    select id, stock_pending, stock_deferred into v_order
      from public.orders where id = v_debt.id;

    if not v_order.stock_deferred then
      continue;
    end if;

    if v_covered and v_order.stock_pending then
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

    elsif not v_covered and not v_order.stock_pending then
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
           set stock = stock + v_qty,
               is_active = true
         where store_id = p_store_id and id = v_target_id;

        insert into public.stock_movements (store_id, product_id, product_name, quantity, reason, order_id)
        values (p_store_id, v_target_id, v_item.name, v_qty, 'cancelamento', v_debt.id);

        perform public.sync_pack_stock(p_store_id, v_target_id);
      end loop;

      update public.orders set stock_pending = true where id = v_debt.id;
    end if;
  end loop;

  return jsonb_build_object('success', true);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;

-- ── update_fiado_payment: edita valor e/ou forma de um pagamento ───────
CREATE OR REPLACE FUNCTION public.update_fiado_payment(
  p_store_id uuid, p_payment_id uuid, p_amount numeric, p_payment_method text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_customer uuid;
begin
  if not is_store_admin(p_store_id) then
    return jsonb_build_object('success', false, 'error', 'Sem permissão.');
  end if;

  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Informe um valor válido.');
  end if;

  update public.pdv_customer_payments
     set amount = p_amount,
         payment_method = coalesce(p_payment_method, payment_method)
   where id = p_payment_id and store_id = p_store_id
  returning customer_id into v_customer;

  if v_customer is null then
    return jsonb_build_object('success', false, 'error', 'Pagamento não encontrado.');
  end if;

  perform public.settle_fiado_stock(p_store_id, v_customer);

  return jsonb_build_object('success', true);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;

-- ── delete_fiado_payment: apaga um pagamento ───────────────────────────
CREATE OR REPLACE FUNCTION public.delete_fiado_payment(p_store_id uuid, p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_customer uuid;
begin
  if not is_store_admin(p_store_id) then
    return jsonb_build_object('success', false, 'error', 'Sem permissão.');
  end if;

  delete from public.pdv_customer_payments
   where id = p_payment_id and store_id = p_store_id
  returning customer_id into v_customer;

  if v_customer is null then
    return jsonb_build_object('success', false, 'error', 'Pagamento não encontrado.');
  end if;

  perform public.settle_fiado_stock(p_store_id, v_customer);

  return jsonb_build_object('success', true);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;

COMMIT;
