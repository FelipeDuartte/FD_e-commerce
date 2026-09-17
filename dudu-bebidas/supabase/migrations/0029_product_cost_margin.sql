BEGIN;

-- ─────────────────────────────────────────────────────────────
-- Custo de compra por produto — permite calcular margem (preço de
-- venda − custo) na aba Produtos. Guarda só o custo mais recente
-- conhecido (não histórico por lote/FIFO — desproporcional pro porte
-- da loja); cada nova compra sobrescreve, mas o operador vê a
-- comparação com o valor anterior na hora de registrar.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_price numeric(10,2);

ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS unit_cost numeric(10,2);

ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_reason_check;
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_reason_check
  CHECK (reason IN ('venda', 'cancelamento', 'ajuste_manual', 'compra'));

-- ── register_product_purchase: reabastece estoque + registra custo ────────
-- Chamada direto pelo client (aba Produtos) — precisa validar admin como
-- sync_pack_stock. Retorna o custo anterior junto do novo pra tela
-- mostrar "subiu/desceu X%" antes de qualquer coisa ser sobrescrita.
CREATE OR REPLACE FUNCTION public.register_product_purchase(
  p_store_id uuid, p_product_id text, p_quantity integer, p_unit_cost numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_product record;
begin
  if not is_store_admin(p_store_id) then
    return jsonb_build_object('success', false, 'error', 'Acesso restrito a administradores de loja.');
  end if;

  if p_quantity is null or p_quantity <= 0 then
    return jsonb_build_object('success', false, 'error', 'Quantidade inválida.');
  end if;

  if p_unit_cost is null or p_unit_cost < 0 then
    return jsonb_build_object('success', false, 'error', 'Valor pago inválido.');
  end if;

  select id, name, stock, cost_price
    into v_product
    from public.products
   where store_id = p_store_id and id = p_product_id
   for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Produto não encontrado.');
  end if;

  update public.products
     set stock = stock + p_quantity,
         cost_price = p_unit_cost,
         is_active = true
   where store_id = p_store_id and id = p_product_id;

  insert into public.stock_movements (store_id, product_id, product_name, quantity, reason, unit_cost, created_by)
  values (p_store_id, v_product.id, v_product.name, p_quantity, 'compra', p_unit_cost, auth.uid());

  -- Se esse produto for base de algum fardo, o estoque calculado dele
  -- também precisa recalcular (mesma função já usada em vendas/cancelamentos).
  perform public.sync_pack_stock(p_store_id, v_product.id);

  return jsonb_build_object(
    'success', true,
    'previous_cost', v_product.cost_price,
    'new_cost', p_unit_cost
  );
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;

COMMIT;
