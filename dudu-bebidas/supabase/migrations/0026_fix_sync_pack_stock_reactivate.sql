BEGIN;

-- ─────────────────────────────────────────────────────────────
-- Fix: sync_pack_stock (0025) só desativava o fardo quando o estoque
-- calculado zerava, mas nunca reativava quando voltava a ficar positivo
-- (mantinha is_active como estava, em vez de refletir o valor calculado).
-- Um fardo criado/editado com is_active=false nunca mais voltaria a
-- ficar ativo sozinho, mesmo com estoque de sobra na base — precisa ser
-- incondicional, igual o resto do sistema já faz (process_order etc.).
-- ─────────────────────────────────────────────────────────────

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
         is_active = (floor(base.stock::numeric / p.pack_units) > 0)
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

COMMIT;
