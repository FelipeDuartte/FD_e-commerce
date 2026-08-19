BEGIN;

-- ─────────────────────────────────────────────────────────────
-- Histórico de movimentação de estoque — cada mudança em
-- products.stock vira uma linha aqui: venda (online/balcão, com o
-- pedido), cancelamento (devolução) ou ajuste manual (edição direta
-- na aba Produtos).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE public.stock_movements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid NOT NULL REFERENCES public.stores(id),
  product_id    text NOT NULL,
  -- Nome guardado aqui (não só via product_id) — mesmo padrão de
  -- order_items.name: evita depender de join por chave composta pra exibir
  -- histórico, e mantém o nome exibido mesmo se o produto for renomeado depois.
  product_name  text NOT NULL,
  quantity      integer NOT NULL, -- positivo = entrada, negativo = saída
  reason        text NOT NULL CHECK (reason IN ('venda', 'cancelamento', 'ajuste_manual')),
  order_id      uuid REFERENCES public.orders(id),
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (product_id, store_id) REFERENCES public.products(id, store_id)
);

CREATE INDEX idx_stock_movements_store_product_created
  ON public.stock_movements(store_id, created_at DESC);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de cash_sessions: só admin da própria loja, nenhum acesso público.
CREATE POLICY stock_movements_admin_all ON public.stock_movements
  FOR ALL TO authenticated
  USING (is_store_admin(store_id))
  WITH CHECK (is_store_admin(store_id));

-- ── process_order: loga a saída de cada item vendido ──────────────────────────
CREATE OR REPLACE FUNCTION public.process_order(p_store_id uuid, p_order_id uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
declare
  item      jsonb;
  v_product record;
  errors    text[] := '{}';
begin
  for item in select * from jsonb_array_elements(p_items)
  loop
    select id, name, stock, is_active
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

    if v_product.stock < (item->>'quantity')::int then
      errors := array_append(errors,
        format('Estoque insuficiente para "%s" (disponível: %s)',
               v_product.name, v_product.stock));
      continue;
    end if;

    update public.products
       set stock = stock - (item->>'quantity')::int,
           is_active = case
                         when stock - (item->>'quantity')::int <= 0 then false
                         else true
                       end
     where store_id = p_store_id
       and id = v_product.id;

    insert into public.stock_movements (store_id, product_id, product_name, quantity, reason, order_id)
    values (p_store_id, v_product.id, v_product.name, -(item->>'quantity')::int, 'venda', p_order_id);

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

-- ── restore_stock: loga a entrada de volta ao cancelar ─────────────────────────
CREATE OR REPLACE FUNCTION public.restore_stock(p_order_id uuid, p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  item record;
begin
  for item in
    select product_id, name, quantity
      from public.order_items
     where order_id = p_order_id
  loop
    update public.products
       set stock = stock + item.quantity,
           is_active = true
     where store_id = p_store_id
       and id = item.product_id;

    insert into public.stock_movements (store_id, product_id, product_name, quantity, reason, order_id)
    values (p_store_id, item.product_id, item.name, item.quantity, 'cancelamento', p_order_id);

  end loop;

  return jsonb_build_object('success', true);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;

COMMIT;
