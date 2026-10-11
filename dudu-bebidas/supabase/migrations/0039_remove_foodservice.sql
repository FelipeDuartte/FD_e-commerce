BEGIN;

-- ─────────────────────────────────────────────────────────────
-- Plataforma passa a ser só bebidas/varejo (continua multi-loja).
-- Remove tudo que existia para foodservice:
--   - loja de teste "braza-burger" (type = 'fastfood') e todos os dados dela
--   - adicionais de produto: product_modifier_groups / product_modifier_options
--     (com triggers e policies, que saem junto com as tabelas)
--   - order_items.selected_modifiers (nenhum código usa)
-- e trava stores.type em 'bebidas' | 'varejo'.
--
-- A conta de login do admin da braza-burger NÃO é apagada aqui — só é
-- desligada da loja (profiles.store_id = null). Apagar a conta é passo à
-- parte, no painel Authentication.
--
-- Tudo numa transação: qualquer erro desfaz o script inteiro.
-- ─────────────────────────────────────────────────────────────

-- Travas de segurança: só segue se a loja for mesmo a de foodservice e se
-- nenhum pedido de outra loja tiver adicionais gravados.
DO $$
DECLARE
  v_store uuid;
BEGIN
  SELECT id INTO v_store FROM public.stores WHERE slug = 'braza-burger' AND type = 'fastfood';
  IF v_store IS NULL THEN
    RAISE EXCEPTION 'Loja braza-burger (fastfood) não encontrada — nada foi alterado.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.order_items
     WHERE store_id <> v_store
       AND selected_modifiers IS NOT NULL
       AND selected_modifiers NOT IN ('[]'::jsonb, '{}'::jsonb, 'null'::jsonb)
  ) THEN
    RAISE EXCEPTION 'Existem adicionais em pedidos de outra loja — nada foi alterado.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.stores WHERE id <> v_store AND type IS NOT NULL AND type NOT IN ('bebidas', 'varejo')) THEN
    RAISE EXCEPTION 'Existe outra loja com tipo diferente de bebidas/varejo — nada foi alterado.';
  END IF;
END $$;

-- 1) Estrutura de foodservice
DROP TABLE public.product_modifier_options;
DROP TABLE public.product_modifier_groups;
ALTER TABLE public.order_items DROP COLUMN selected_modifiers;

-- 2) Dados da loja braza-burger (filhos antes dos pais, por causa das FKs)
CREATE TEMP TABLE _braza ON COMMIT DROP AS
  SELECT id FROM public.stores WHERE slug = 'braza-burger';

DELETE FROM public.stock_movements       WHERE store_id IN (SELECT id FROM _braza);
DELETE FROM public.pdv_customer_payments WHERE store_id IN (SELECT id FROM _braza);
DELETE FROM public.pdv_customer_charges  WHERE store_id IN (SELECT id FROM _braza);
DELETE FROM public.order_payments        WHERE store_id IN (SELECT id FROM _braza);
DELETE FROM public.order_items           WHERE store_id IN (SELECT id FROM _braza);
DELETE FROM public.orders                WHERE store_id IN (SELECT id FROM _braza);
DELETE FROM public.pdv_customers         WHERE store_id IN (SELECT id FROM _braza);
DELETE FROM public.cash_sessions         WHERE store_id IN (SELECT id FROM _braza);
DELETE FROM public.accounts_payable      WHERE store_id IN (SELECT id FROM _braza);
DELETE FROM public.couriers              WHERE store_id IN (SELECT id FROM _braza);

UPDATE public.products SET pack_of_product_id = NULL WHERE store_id IN (SELECT id FROM _braza);
DELETE FROM public.products              WHERE store_id IN (SELECT id FROM _braza);

DELETE FROM public.categories            WHERE store_id IN (SELECT id FROM _braza);
DELETE FROM public.delivery_zones        WHERE store_id IN (SELECT id FROM _braza);
DELETE FROM public.store_config          WHERE store_id IN (SELECT id FROM _braza);
DELETE FROM public.store_hours           WHERE store_id IN (SELECT id FROM _braza);
DELETE FROM public.store_order_counters  WHERE store_id IN (SELECT id FROM _braza);
DELETE FROM public.store_payment_configs WHERE store_id IN (SELECT id FROM _braza);
DELETE FROM public.whatsapp_configs      WHERE store_id IN (SELECT id FROM _braza);

UPDATE public.profiles SET store_id = NULL WHERE store_id IN (SELECT id FROM _braza);

DELETE FROM public.stores WHERE id IN (SELECT id FROM _braza);

-- 3) Daqui pra frente só bebidas/varejo
ALTER TABLE public.stores
  ADD CONSTRAINT stores_type_check CHECK (type IN ('bebidas', 'varejo'));

COMMIT;
