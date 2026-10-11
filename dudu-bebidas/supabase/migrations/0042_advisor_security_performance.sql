BEGIN;

-- ─────────────────────────────────────────────────────────────
-- Correções apontadas pelo Security/Performance Advisor do Supabase.
--
-- 1) Funções SECURITY DEFINER rodam com permissão total, ignorando RLS.
--    Por padrão o Supabase deixa qualquer visitante (anon) e qualquer
--    usuário logado chamá-las via /rest/v1/rpc. Algumas não conferem quem
--    chama — a mais grave era confirm_mercadopago_payment: um cliente podia
--    marcar o próprio pedido de cartão online como "pago" sem pagar.
--
--    a) Só servidor/uso interno → ninguém de fora chama.
--       (edge functions usam service_role; funções que chamam outras, como
--       cancel_pdv_sale → restore_stock, rodam como dono e não são afetadas;
--       trigger não confere EXECUTE ao disparar.)
--    b) Admin/entregador → já conferem quem chama por dentro; tira só o
--       visitante anônimo, como camada extra.
--    c) Ficam públicas de propósito (o site usa sem login, ou são usadas
--       pelas próprias regras de RLS): cancel_order, get_order_status,
--       get_mercadopago_public_config, mark_customer_claimed_paid,
--       is_store_admin, current_store_id.
--
-- 2) search_path fixo nas 3 funções que estavam sem.
--
-- 3) RLS: auth.uid() dentro de policy era recalculado linha a linha;
--    (select auth.uid()) calcula uma vez por consulta. Só reescreve as 5
--    policies apontadas, mantendo a mesma regra.
--
-- Tudo numa transação: qualquer erro desfaz o script inteiro.
-- ─────────────────────────────────────────────────────────────

-- 1a) Só servidor / uso interno
REVOKE EXECUTE ON FUNCTION public.confirm_mercadopago_payment(uuid, uuid, text)           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_rejected_mercadopago_order(uuid, uuid)           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_mercadopago_payment_failed(uuid, uuid, text, text)  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restore_stock(uuid, uuid)                               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_order_number()                                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_profile()                                        FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.confirm_mercadopago_payment(uuid, uuid, text)          TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_rejected_mercadopago_order(uuid, uuid)          TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_mercadopago_payment_failed(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.restore_stock(uuid, uuid)                              TO service_role;

-- 1b) Admin / entregador logado — tira só o visitante anônimo
REVOKE EXECUTE ON FUNCTION public.cancel_pdv_sale(uuid, uuid)                                  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.close_cash_session(uuid, numeric)                            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_fiado_payment(uuid, uuid)                             FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_fiado_payment(uuid, uuid, numeric, text)              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.register_product_bonus(uuid, text, integer)                  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.register_product_purchase(uuid, text, integer, numeric)      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.remove_pdv_sale_item(uuid, uuid, uuid)                       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.settle_fiado_stock(uuid, uuid)                               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.undo_last_product_purchase(uuid, uuid)                       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_pack_stock(uuid, text)                                  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_order_paid(uuid, uuid)                                  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.promote_store_admin(text)                                    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.demote_store_admin(uuid)                                     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.courier_advance_order_status(uuid)                           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.upsert_courier_location(numeric, numeric)                    FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.cancel_pdv_sale(uuid, uuid)                             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.close_cash_session(uuid, numeric)                       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_fiado_payment(uuid, uuid)                        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_fiado_payment(uuid, uuid, numeric, text)         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.register_product_bonus(uuid, text, integer)             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.register_product_purchase(uuid, text, integer, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_pdv_sale_item(uuid, uuid, uuid)                  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.settle_fiado_stock(uuid, uuid)                          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.undo_last_product_purchase(uuid, uuid)                  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_pack_stock(uuid, text)                             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_order_paid(uuid, uuid)                             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.promote_store_admin(text)                               TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.demote_store_admin(uuid)                                TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.courier_advance_order_status(uuid)                      TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_courier_location(numeric, numeric)               TO authenticated, service_role;

-- 2) search_path fixo
ALTER FUNCTION public.current_store_id        SET search_path = public;
ALTER FUNCTION public.set_order_item_store_id SET search_path = public;
ALTER FUNCTION public.process_order(uuid, uuid, jsonb) SET search_path = public;

-- 3) auth.uid() calculado uma vez por consulta nas 5 policies apontadas.
--    Reescreve a própria expressão salva no banco (mesma regra), só
--    trocando auth.uid() por (select auth.uid()).
DO $$
DECLARE
  r       record;
  v_using text;
  v_check text;
  v_sql   text;
BEGIN
  FOR r IN
    SELECT tablename, policyname, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
       AND (tablename, policyname) IN (
         ('couriers',    'couriers_self_read'),
         ('orders',      'orders_courier_read_assigned'),
         ('orders',      'orders_customer_read_own'),
         ('order_items', 'order_items_customer_read_own'),
         ('profiles',    'profiles_read_own')
       )
  LOOP
    v_using := regexp_replace(r.qual,       '(?<!select )auth\.uid\(\)', '(select auth.uid())', 'g');
    v_check := regexp_replace(r.with_check, '(?<!select )auth\.uid\(\)', '(select auth.uid())', 'g');

    v_sql := format('ALTER POLICY %I ON public.%I', r.policyname, r.tablename);
    IF v_using IS NOT NULL THEN v_sql := v_sql || format(' USING (%s)', v_using); END IF;
    IF v_check IS NOT NULL THEN v_sql := v_sql || format(' WITH CHECK (%s)', v_check); END IF;

    RAISE NOTICE '%', v_sql;
    EXECUTE v_sql;
  END LOOP;
END $$;

COMMIT;
