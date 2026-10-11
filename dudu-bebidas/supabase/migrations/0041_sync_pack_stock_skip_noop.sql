BEGIN;

-- ─────────────────────────────────────────────────────────────
-- sync_pack_stock regravava o fardo em toda venda/compra do produto base,
-- mesmo quando o estoque calculado do fardo não mudava (ex: base 23 → 22
-- com fardo de 12 continua 1). Cada regravação disparava um aviso de
-- realtime pra todos os terminais à toa. Agora só grava quando o valor
-- muda. Resto idêntico à versão de 0027.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_pack_stock(p_store_id uuid, p_product_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  update public.products p
     set stock = floor(base.stock::numeric / p.pack_units)::int,
         is_active = (floor(base.stock::numeric / p.pack_units) > 0)
    from public.products base
   where p.store_id = p_store_id
     and base.store_id = p_store_id
     and (
       (p.id = p_product_id and p.pack_of_product_id = base.id)
       or (base.id = p_product_id and p.pack_of_product_id = base.id)
     )
     and (
       p.stock is distinct from floor(base.stock::numeric / p.pack_units)::int
       or p.is_active is distinct from (floor(base.stock::numeric / p.pack_units) > 0)
     );

  return jsonb_build_object('success', true);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;

COMMIT;
