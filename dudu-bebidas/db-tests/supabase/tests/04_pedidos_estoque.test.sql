-- Criação de pedido (create_order_atomic), baixa e devolução de estoque.
-- create_order_atomic só é chamada pelas edge functions (service role).
begin;
select no_plan();

create temp table resultado (nome text primary key, valor jsonb) on commit drop;
grant all on resultado to service_role, authenticated, anon;

-- Atalho: estoque atual de um produto
create function pg_temp.estoque(p_loja text, p_produto text) returns int language sql as $$
  select stock from public.products where store_id = tests.id(p_loja) and id = p_produto
$$;

set local role service_role;

-- ── Pedido normal ───────────────────────────────────────────
insert into resultado values ('pedido_ok', public.create_order_atomic(
  tests.id('loja_a'),
  '{"total": 18, "payment_method": "pix", "status": "pending", "channel": "online"}',
  '[{"product_id": "heineken", "name": "Heineken Lata", "price": 6, "quantity": 3}]'
));
reset role;

select is(pg_temp.estoque('loja_a', 'heineken'), 7, 'pedido baixa o estoque da loja certa (10 → 7)');
select is(pg_temp.estoque('loja_b', 'heineken'), 50, 'o produto de mesmo código na loja B não é tocado');
select is((select (valor->>'order_number')::int from resultado where nome = 'pedido_ok'), 3,
  'número do pedido segue a sequência da loja A (já tinha 2)');
select is(
  (select store_id from order_items where order_id = (select (valor->>'order_id')::uuid from resultado where nome = 'pedido_ok')),
  tests.id('loja_a'), 'itens do pedido herdam a loja do pedido');
select is(
  (select quantity from stock_movements where order_id = (select (valor->>'order_id')::uuid from resultado where nome = 'pedido_ok')),
  -3, 'baixa registrada no histórico de estoque');

-- Numeração independente por loja
set local role service_role;
insert into resultado values ('pedido_b', public.create_order_atomic(
  tests.id('loja_b'),
  '{"total": 5.5, "payment_method": "cash", "status": "pending", "channel": "online"}',
  '[{"product_id": "heineken", "name": "Heineken Lata B", "price": 5.5, "quantity": 1}]'
));
reset role;
select is((select (valor->>'order_number')::int from resultado where nome = 'pedido_b'), 2,
  'loja B tem a própria numeração (já tinha 1)');

-- ── Pedido que não pode acontecer não grava nada ────────────
create temp table antes as select count(*) as pedidos from orders;

set local role service_role;
select throws_like(
  $$ select public.create_order_atomic(tests.id('loja_a'),
       '{"total": 51, "payment_method": "cash", "status": "pending", "channel": "online"}',
       '[{"product_id": "brahma", "name": "Brahma", "price": 8.5, "quantity": 6}]') $$,
  '%Estoque insuficiente para "Brahma 600ml" (disponível: 5)%',
  'mais do que tem em estoque: recusa com a quantidade disponível');
select throws_like(
  $$ select public.create_order_atomic(tests.id('loja_a'),
       '{"total": 1, "payment_method": "cash", "status": "pending", "channel": "online"}',
       '[{"product_id": "desativado", "name": "X", "price": 1, "quantity": 1}]') $$,
  '%não está disponível%', 'produto desativado: recusa');
select throws_like(
  $$ select public.create_order_atomic(tests.id('loja_a'),
       '{"total": 1, "payment_method": "cash", "status": "pending", "channel": "online"}',
       '[{"product_id": "so-existe-na-b", "name": "X", "price": 1, "quantity": 1}]') $$,
  '%order_items_product_fkey%', 'produto que não é da loja: o banco nem aceita o item');
select throws_like(
  $$ select public.create_order_atomic(tests.id('loja_a'),
       '{"total": 0, "payment_method": "cash", "status": "pending", "channel": "online"}', '[]') $$,
  '%Carrinho vazio%', 'carrinho vazio: recusa');
select throws_like(
  $$ select public.create_order_atomic(tests.id('loja_a'),
       '{"total": 14.5, "payment_method": "cash", "status": "pending", "channel": "online"}',
       '[{"product_id": "heineken", "name": "Heineken", "price": 6, "quantity": 1},
         {"product_id": "brahma", "name": "Brahma", "price": 8.5, "quantity": 99}]') $$,
  '%Estoque insuficiente%', 'um item sem estoque derruba o pedido inteiro');
reset role;
select is((select count(*) from orders), (select pedidos from antes), 'nenhum pedido recusado ficou gravado');
select is(pg_temp.estoque('loja_a', 'heineken'), 7, 'o item que tinha estoque não foi baixado (tudo ou nada)');

-- ── Estoque zerado tira o produto do site ───────────────────
set local role service_role;
insert into resultado values ('zerou', public.create_order_atomic(tests.id('loja_a'),
  '{"total": 42.5, "payment_method": "cash", "status": "pending", "channel": "online"}',
  '[{"product_id": "brahma", "name": "Brahma 600ml", "price": 8.5, "quantity": 5}]'));
reset role;
select is(pg_temp.estoque('loja_a', 'brahma'), 0, 'última unidade vendida: estoque 0');
select is((select is_active from products where store_id = tests.id('loja_a') and id = 'brahma'), false,
  'estoque zerado: produto sai do site');

-- ── Baixa adiada (pagamento online / fiado com produtos) ─────
set local role service_role;
insert into resultado values ('adiado', public.create_order_atomic(tests.id('loja_a'),
  '{"total": 6, "payment_method": "infinitepay", "status": "pending", "channel": "online",
    "payment_status": "aguardando_pagamento", "payment_provider": "infinitepay", "stock_pending": true}',
  '[{"product_id": "heineken", "name": "Heineken Lata", "price": 6, "quantity": 1}]',
  '[]', false));
reset role;
select is(pg_temp.estoque('loja_a', 'heineken'), 7, 'baixa adiada: estoque não muda na criação');

-- ── Rejeitar pedido devolve o estoque (uma vez só) ──────────
select tests.como(tests.id('admin_a'), tests.id('loja_a'));
select is(public.reject_order(tests.id('pedido_a1'), tests.id('loja_a'))->>'stock_restored', 'true',
  'admin rejeita o pedido A1');
select is(public.reject_order(tests.id('pedido_a1'), tests.id('loja_a'))->>'already_closed', 'true',
  'rejeitar de novo não faz nada');
select public.reject_order((select (valor->>'order_id')::uuid from resultado where nome = 'adiado'), tests.id('loja_a'));
reset role;
select is(pg_temp.estoque('loja_a', 'heineken'), 9, 'as 2 Heineken do A1 voltaram uma vez só, e o pagamento online não pago não devolveu nada (7 → 9)');
select is((select status from orders where id = tests.id('pedido_a1')), 'rejected', 'pedido A1 rejeitado');

-- ── Cliente cancelando o próprio pedido (tela de confirmação) ─
select tests.como(null, tests.id('loja_b'));
select is(public.cancel_order(tests.id('pedido_b1'), tests.id('loja_a'))->>'error', 'Pedido não pertence a esta loja.',
  'cancelar informando a loja errada: recusa');
select is(public.cancel_order(tests.id('pedido_a2'), tests.id('loja_a'))->>'error',
  'Esse pedido já está em preparo e não pode mais ser cancelado.', 'pedido que já saiu: não cancela');
select is(public.cancel_order(tests.id('pedido_b1'), tests.id('loja_b'))->>'success', 'true',
  'pedido ainda pendente: cliente cancela');
reset role;
select is(pg_temp.estoque('loja_b', 'heineken'), 51, 'cancelamento devolve as 2 unidades na loja B (49 → 51)');

-- ── Devolver estoque × produto fora do site ─────────────────
-- Produto que saiu do site por ter ACABADO volta quando o estoque volta
select tests.como(tests.id('admin_a'), tests.id('loja_a'));
select public.reject_order((select (valor->>'order_id')::uuid from resultado where nome = 'zerou'), tests.id('loja_a'));
reset role;
select is(pg_temp.estoque('loja_a', 'brahma'), 5, 'rejeitar devolve as 5 Brahma');
select is((select is_active from products where store_id = tests.id('loja_a') and id = 'brahma'), true,
  'produto que tinha acabado volta pro site junto com o estoque');

-- Produto que a LOJA tirou do site (com estoque) continua fora
update products set is_active = false where store_id = tests.id('loja_a') and id = 'heineken';
select tests.como(tests.id('admin_a'), tests.id('loja_a'));
select public.reject_order((select (valor->>'order_id')::uuid from resultado where nome = 'pedido_ok'), tests.id('loja_a'));
select public.register_product_purchase(tests.id('loja_a'), 'desativado', 10, 1.00);
reset role;
select is(pg_temp.estoque('loja_a', 'heineken'), 12, 'rejeitar devolve as 3 Heineken (9 → 12)');
select is((select is_active from products where store_id = tests.id('loja_a') and id = 'heineken'), false,
  'devolver estoque não reativa produto que a loja desligou');
select is((select is_active from products where store_id = tests.id('loja_a') and id = 'desativado'), false,
  'registrar compra não reativa produto que a loja desligou');
select is(pg_temp.estoque('loja_a', 'desativado'), 13, 'mas a compra entra no estoque (3 → 13)');

select * from finish();
rollback;
