BEGIN;

-- ─────────────────────────────────────────────────────────────
-- Fix: a checagem is_store_admin em sync_pack_stock (adicionada em 0025
-- pensando na chamada direta do cadastro no PDV) também bloqueava a
-- chamada INTERNA feita por process_order/restore_stock/
-- confirm_mercadopago_payment sempre que o contexto de auth dessas
-- funções não é o de um admin logado (ex: pedido do site, webhook do
-- Mercado Pago) — a trava barrava silenciosamente e a caixa nunca
-- recalculava, sem erro nenhum aparecer pro operador.
--
-- Removendo a trava: essa função só RECALCULA um valor derivado
-- (estoque do fardo = estoque da base ÷ unidades), nunca escreve um
-- valor arbitrário — não tem como usar isso pra inflar/derrubar estoque
-- de outra loja de propósito, então não precisa do mesmo nível de
-- proteção de funções que alteram dinheiro/pedidos de verdade.
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
     );

  return jsonb_build_object('success', true);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;

COMMIT;
