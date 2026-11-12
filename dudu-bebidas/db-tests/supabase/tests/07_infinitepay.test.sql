-- Pagamento online pela InfinitePay (migration 0057): confirmação do
-- pagamento só pelo servidor, estoque baixado só quando pagar, taxa do
-- cartão do cliente registrada à parte.
begin;
select no_plan();

create temp table resultado (nome text primary key, valor jsonb) on commit drop;
grant all on resultado to service_role, authenticated, anon;

create function pg_temp.estoque(p_produto text) returns int language sql as $$
  select stock from public.products where store_id = tests.id('loja_a') and id = p_produto
$$;
create function pg_temp.pedido(p_nome text) returns uuid language sql as $$
  select (valor->>'order_id')::uuid from resultado where nome = p_nome
$$;

-- Configuração da InfinitePay da loja A
update store_payment_configs
   set infinitepay_handle = 'loja-a', infinitepay_api_key = 'inchk_SEGREDO'
 where store_id = tests.id('loja_a');

-- Pedido online aguardando pagamento (como a create-order cria): 2 Heineken + R$ 5 de frete
set local role service_role;
insert into resultado values ('online', public.create_order_atomic(
  tests.id('loja_a'),
  '{"total": 17, "payment_method": "infinitepay", "status": "pending", "channel": "online",
    "payment_status": "aguardando_pagamento", "payment_provider": "infinitepay", "stock_pending": true}',
  '[{"product_id": "heineken", "name": "Heineken Lata", "price": 6, "quantity": 2}]',
  '[]', false));
insert into resultado values ('cartao', public.create_order_atomic(
  tests.id('loja_a'),
  '{"total": 17, "payment_method": "infinitepay", "status": "pending", "channel": "online",
    "payment_status": "aguardando_pagamento", "payment_provider": "infinitepay", "stock_pending": true}',
  '[{"product_id": "brahma", "name": "Brahma 600ml", "price": 8.5, "quantity": 2}]',
  '[]', false));
reset role;

select is(pg_temp.estoque('heineken'), 10, 'pedido online não pago: estoque intacto');

-- ── Quem pode o quê ─────────────────────────────────────────
select ok(not has_function_privilege(r, 'public.confirm_infinitepay_payment(uuid, uuid, text, text, numeric, integer)', 'execute'),
  format('%s não confirma pagamento', r))
  from unnest(array['anon', 'authenticated']) r;

select tests.como(null, tests.id('loja_a'));
select is(public.get_online_payment_config(tests.id('loja_a')), '{"infinitepay": true}'::jsonb, 'site: loja A tem pagamento online');
select is(public.get_online_payment_config(tests.id('loja_inativa')), '{"infinitepay": false}'::jsonb, 'site: loja sem InfinitePay não tem');
select ok(public.get_online_payment_config(tests.id('loja_a'))::text not like '%SEGREDO%', 'site: a chave da InfinitePay nunca sai');
select is(tests.linhas_visiveis('store_payment_configs'), 0, 'visitante não lê a chave da InfinitePay');
reset role;

-- ── Pix pago ────────────────────────────────────────────────
set local role service_role;
insert into resultado values ('conf_pix', public.confirm_infinitepay_payment(
  pg_temp.pedido('online'), tests.id('loja_a'), 'tx-pix-1', 'pix', 17.00, 1));
reset role;
select is((select valor->>'stock_decremented' from resultado where nome = 'conf_pix'), 'true', 'Pix pago: confirma');
select is(pg_temp.estoque('heineken'), 8, 'Pix pago: baixa as 2 Heineken');
select results_eq(
  format($$ select payment_status, payment_method, payment_reference, total, card_fee_amount, installments, stock_pending
              from orders where id = '%s' $$, pg_temp.pedido('online')),
  $$ values ('pago'::text, 'pix'::text, 'tx-pix-1'::text, 17.00::numeric, 0.00::numeric, null::smallint, false) $$,
  'Pix: forma vira "pix", sem taxa, com o número da transação');

-- Aviso e volta do cliente chegando os dois: não baixa de novo
set local role service_role;
select is(public.confirm_infinitepay_payment(pg_temp.pedido('online'), tests.id('loja_a'), 'tx-pix-1', 'pix', 17.00, 1)->>'already_paid',
  'true', 'confirmar de novo não faz nada');
reset role;
select is(pg_temp.estoque('heineken'), 8, 'estoque baixado uma vez só');

-- ── Cartão com taxa repassada ao cliente ────────────────────
set local role service_role;
select public.confirm_infinitepay_payment(pg_temp.pedido('cartao'), tests.id('loja_a'), 'tx-card-1', 'credit_card', 17.55, 1);
reset role;
select results_eq(
  format($$ select payment_method, total, card_fee_amount, installments from orders where id = '%s' $$, pg_temp.pedido('cartao')),
  $$ values ('online_card'::text, 17.55::numeric, 0.55::numeric, 1::smallint) $$,
  'cartão: total = o que o cliente pagou; taxa separada (não conta como venda)');

-- ── Outros casos ────────────────────────────────────────────
set local role service_role;
select is(public.confirm_infinitepay_payment(tests.id('pedido_a1'), tests.id('loja_a'), 'tx', 'pix', 12, 1)->>'error',
  'Pedido não encontrado.', 'pedido que não é InfinitePay: não confirma');
select is(public.confirm_infinitepay_payment(pg_temp.pedido('online'), tests.id('loja_b'), 'tx', 'pix', 17, 1)->>'error',
  'Pedido não encontrado.', 'loja errada: não confirma');
reset role;
select is((select payment_status from orders where id = tests.id('pedido_a1')), 'pago', 'pedido Pix manual intocado');

-- ── Status do pedido devolve o link de pagamento ────────────
update orders set payment_link_url = 'https://checkout.infinitepay.com.br/x' where id = pg_temp.pedido('cartao');
select tests.como(null, tests.id('loja_a'));
select is(public.get_order_status(pg_temp.pedido('cartao'), tests.id('loja_a'))->>'payment_link_url',
  'https://checkout.infinitepay.com.br/x', 'status do pedido traz o link (botão "Pagar agora")');
select is(public.get_order_status(pg_temp.pedido('cartao'), tests.id('loja_a'))->>'payment_provider', 'infinitepay', 'e o provedor');
reset role;

select * from finish();
rollback;
