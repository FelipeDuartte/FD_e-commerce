BEGIN;

-- ─────────────────────────────────────────────────────────────
-- Venda/pedido numa transação só.
--
-- Antes, fulfillOrder (edge functions pdv-sale, create-order e
-- mercadopago-create-payment) fazia 4–5 chamadas separadas: insere o
-- pedido, os pagamentos divididos, os itens e só então baixa o estoque
-- (process_order). Se a baixa falhasse — ex: estoque insuficiente porque
-- outro terminal/o site vendeu a última unidade no mesmo segundo — pedido e
-- itens ficavam gravados mesmo assim: no balcão nascia "entregue" e ligado
-- ao caixa, entrando no fechamento e nos relatórios sem ter baixado
-- estoque, e o operador acabava lançando a venda de novo.
--
-- Agora tudo roda aqui dentro: qualquer erro desfaz o pedido inteiro (e o
-- aviso de WhatsApp de pedido novo, que só sai no commit). Preço/total
-- continuam sendo calculados na edge function a partir do banco — esta
-- função só grava o que recebe, por isso só o service role pode chamá-la.
--
-- process_order não muda: continua sendo quem valida e baixa o estoque.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_order_atomic(
  p_store_id        uuid,
  p_order           jsonb,
  p_items           jsonb,
  p_payments        jsonb   DEFAULT '[]'::jsonb,
  p_decrement_stock boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare
  v_order_id     uuid;
  v_order_number int;
  v_stock        jsonb;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'ORDER_ERRORS: Carrinho vazio.';
  end if;

  insert into public.orders (
    store_id, user_id, total, discount_amount, card_fee_amount,
    payment_method, installments, address, status, channel,
    cash_session_id, sold_by, payment_status, payment_provider,
    pdv_customer_id, stock_pending, stock_deferred
  ) values (
    p_store_id,
    nullif(p_order->>'user_id', '')::uuid,
    (p_order->>'total')::numeric,
    coalesce((p_order->>'discount_amount')::numeric, 0),
    coalesce((p_order->>'card_fee_amount')::numeric, 0),
    p_order->>'payment_method',
    nullif(p_order->>'installments', '')::int,
    coalesce(p_order->'address', '{}'::jsonb),
    p_order->>'status',
    p_order->>'channel',
    nullif(p_order->>'cash_session_id', '')::uuid,
    nullif(p_order->>'sold_by', '')::uuid,
    coalesce(nullif(p_order->>'payment_status', ''), 'pago'),
    nullif(p_order->>'payment_provider', ''),
    nullif(p_order->>'pdv_customer_id', '')::uuid,
    coalesce((p_order->>'stock_pending')::boolean, false),
    coalesce((p_order->>'stock_deferred')::boolean, false)
  )
  returning id, order_number into v_order_id, v_order_number;

  insert into public.order_payments (order_id, store_id, method, amount)
  select v_order_id, p_store_id, p->>'method', (p->>'amount')::numeric
    from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) as p;

  -- store_id dos itens é preenchido pelo trigger trg_order_items_store_id
  insert into public.order_items (order_id, product_id, name, price, quantity)
  select v_order_id, i->>'product_id', i->>'name', (i->>'price')::numeric, (i->>'quantity')::int
    from jsonb_array_elements(p_items) as i;

  if p_decrement_stock then
    v_stock := public.process_order(
      p_store_id,
      v_order_id,
      (select jsonb_agg(jsonb_build_object('product_id', i->>'product_id', 'quantity', (i->>'quantity')::int))
         from jsonb_array_elements(p_items) as i)
    );

    -- process_order devolve {success:false} em vez de lançar erro — aqui
    -- vira erro de verdade, o que desfaz o pedido, pagamentos e itens.
    if not coalesce((v_stock->>'success')::boolean, false) then
      raise exception '%', coalesce(v_stock->>'error', 'ORDER_ERRORS: Erro ao processar estoque.');
    end if;
  end if;

  return jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number);
end;
$function$;

-- Grava pedido sem validar preço — só as edge functions (service role)
-- podem chamar, nunca o navegador.
REVOKE ALL ON FUNCTION public.create_order_atomic(uuid, jsonb, jsonb, jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_order_atomic(uuid, jsonb, jsonb, jsonb, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_atomic(uuid, jsonb, jsonb, jsonb, boolean) TO service_role;

COMMIT;
