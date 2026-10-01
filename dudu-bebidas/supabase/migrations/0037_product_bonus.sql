BEGIN;

-- Bonificação do fornecedor: quantidade grátis que entra no estoque quando
-- o dono compra uma certa quantidade de um produto. Diferente de uma
-- compra normal: não tem custo (unit_cost = 0) e, por isso, NÃO sobrescreve
-- products.cost_price — se sobrescrevesse, o resto do estoque (comprado de
-- verdade) passaria a aparecer com 100% de margem por engano, já que o
-- sistema só guarda um custo por produto (sem FIFO/lote, ver 0029).
-- Em vez de tentar rastrear qual venda específica usou uma unidade de
-- bonificação (exigiria repensar estoque por lote do zero), guarda só o
-- valor estimado no momento da entrada: quantidade × preço de venda atual
-- — como o custo é zero, esse valor inteiro já é o lucro daquele lote.
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS bonus_value numeric(10,2);

ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_reason_check;
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_reason_check
  CHECK (reason IN ('venda', 'cancelamento', 'ajuste_manual', 'compra', 'bonificacao'));

-- ── register_product_bonus: dá entrada numa bonificação ────────────────
CREATE OR REPLACE FUNCTION public.register_product_bonus(
  p_store_id uuid, p_product_id text, p_quantity integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_product     record;
  v_bonus_value numeric;
begin
  if not is_store_admin(p_store_id) then
    return jsonb_build_object('success', false, 'error', 'Acesso restrito a administradores de loja.');
  end if;

  if p_quantity is null or p_quantity <= 0 then
    return jsonb_build_object('success', false, 'error', 'Quantidade inválida.');
  end if;

  select id, name, stock, price
    into v_product
    from public.products
   where store_id = p_store_id and id = p_product_id
   for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Produto não encontrado.');
  end if;

  v_bonus_value := p_quantity * coalesce(v_product.price, 0);

  update public.products
     set stock = stock + p_quantity,
         is_active = true
   where store_id = p_store_id and id = p_product_id;

  insert into public.stock_movements
    (store_id, product_id, product_name, quantity, reason, unit_cost, bonus_value, created_by)
  values
    (p_store_id, v_product.id, v_product.name, p_quantity, 'bonificacao', 0, v_bonus_value, auth.uid());

  -- Se esse produto for base de algum fardo, recalcula o estoque calculado dele.
  perform public.sync_pack_stock(p_store_id, v_product.id);

  return jsonb_build_object('success', true, 'bonus_value', v_bonus_value, 'sale_price', v_product.price);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;

-- ── undo_last_product_purchase: agora também desfaz bonificação ────────
-- Mesma regra de sempre (só a entrada MAIS RECENTE desse produto), só que
-- olhando 'compra' e 'bonificacao' juntas como "entrada" — e só restaura
-- cost_price quando a entrada desfeita for uma COMPRA de verdade
-- (bonificação nunca mexeu no custo, não tem o que restaurar ali).
CREATE OR REPLACE FUNCTION public.undo_last_product_purchase(p_store_id uuid, p_movement_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_movement  record;
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

  if v_movement.reason not in ('compra', 'bonificacao') then
    return jsonb_build_object('success', false, 'error', 'Só é possível desfazer uma compra ou bonificação.');
  end if;

  select id into v_latest_id
    from public.stock_movements
   where store_id = p_store_id and product_id = v_movement.product_id and reason in ('compra', 'bonificacao')
   order by created_at desc
   limit 1;

  if v_latest_id is distinct from v_movement.id then
    return jsonb_build_object(
      'success', false,
      'error', 'Só dá pra desfazer a entrada mais recente desse produto — já tem movimentação depois dela.'
    );
  end if;

  if v_movement.reason = 'compra' then
    select unit_cost into v_prev_cost
      from public.stock_movements
     where store_id = p_store_id and product_id = v_movement.product_id and reason = 'compra' and id <> v_movement.id
     order by created_at desc
     limit 1;

    update public.products
       set stock = stock - v_movement.quantity,
           cost_price = v_prev_cost
     where store_id = p_store_id and id = v_movement.product_id;
  else
    update public.products
       set stock = stock - v_movement.quantity
     where store_id = p_store_id and id = v_movement.product_id;
  end if;

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
