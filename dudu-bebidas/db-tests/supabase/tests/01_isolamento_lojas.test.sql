-- Uma loja nunca enxerga nem altera os dados da outra (RLS).
-- As duas lojas têm um produto com o MESMO código ("heineken").
begin;
select no_plan();

-- ── Admin da loja A, no site/PDV da loja A ──────────────────
select tests.como(tests.id('admin_a'), tests.id('loja_a'));

select is((select count(*)::int from products), 3, 'admin A: vê os 3 produtos da loja A (inclusive o desativado)');
select is((select count(*)::int from products where store_id = tests.id('loja_b')), 0, 'admin A: não vê produtos da loja B');
select is((select count(*)::int from product_costs), 1, 'admin A: vê só o custo da loja A');
select is((select count(*)::int from orders where store_id = tests.id('loja_b')), 0, 'admin A: não vê pedidos da loja B');
select is((select count(*)::int from orders), 2, 'admin A: vê os 2 pedidos da loja A');
select is((select count(*)::int from pdv_customers), 1, 'admin A: vê só os clientes do fiado da loja A');
select is((select count(*)::int from cash_sessions), 1, 'admin A: vê só o caixa da loja A');
select is((select count(*)::int from order_items where store_id = tests.id('loja_b')), 0, 'admin A: não vê itens de pedido da loja B');
select is((select count(*)::int from profiles), 1, 'admin A: vê só o perfil da própria equipe');

select throws_ok(
  $$ insert into products (store_id, id, name, category, price, stock) values (tests.id('loja_b'), 'intruso', 'Intruso', 'x', 1, 1) $$,
  '42501', null, 'admin A: não consegue cadastrar produto na loja B');

update products set price = 0.01 where store_id = tests.id('loja_b');
delete from orders where store_id = tests.id('loja_b');
delete from pdv_customers where store_id = tests.id('loja_b');
reset role;
select is((select price from products where store_id = tests.id('loja_b') and id = 'heineken'), 5.50::numeric, 'admin A: tentativa de mudar preço da loja B não tem efeito');
select is((select count(*)::int from orders where store_id = tests.id('loja_b')), 1, 'admin A: tentativa de apagar pedido da loja B não tem efeito');
select is((select count(*)::int from pdv_customers where store_id = tests.id('loja_b')), 1, 'admin A: tentativa de apagar cliente do fiado da loja B não tem efeito');

-- ── Admin da loja A com o header da loja B ──────────────────
-- (ex: admin logado abrindo o site de outra loja)
select tests.como(tests.id('admin_a'), tests.id('loja_b'));
select is((select count(*)::int from product_costs), 0, 'admin A no site da B: não vê custos (nem da A nem da B)');
select is((select count(*)::int from pdv_customers), 0, 'admin A no site da B: não vê clientes do fiado');
select is((select count(*)::int from cash_sessions), 0, 'admin A no site da B: não vê caixas');
select is((select count(*)::int from products), 1, 'admin A no site da B: vê só o catálogo público da B');
update products set price = 0.01 where store_id = tests.id('loja_b');
reset role;
select is((select price from products where store_id = tests.id('loja_b') and id = 'heineken'), 5.50::numeric, 'admin A no site da B: não altera o preço da B');

-- ── Visitante (sem login) ───────────────────────────────────
select tests.como(null, tests.id('loja_a'));
select results_eq(
  $$ select id from products order by id $$,
  $$ values ('brahma'::text), ('heineken'::text) $$,
  'visitante na loja A: vê só os produtos ATIVOS da loja A');
select is((select count(*)::int from orders), 0, 'visitante: não vê pedidos');
select is((select count(*)::int from order_items), 0, 'visitante: não vê itens de pedidos');
select is((select count(*)::int from pdv_customers), 0, 'visitante: não vê clientes do fiado');
select is((select count(*)::int from cash_sessions), 0, 'visitante: não vê caixas');
select is((select count(*)::int from profiles), 0, 'visitante: não vê perfis');
select is((select count(*)::int from stores where id = tests.id('loja_inativa')), 0, 'visitante: loja desativada não aparece');
select throws_ok(
  $$ insert into orders (store_id, total, payment_method, address, order_number) values (tests.id('loja_a'), 1, 'pix', '{}', 999) $$,
  '42501', null, 'visitante: não grava pedido direto na tabela (só pela edge function)');

select tests.como(null, tests.id('loja_b'));
select is((select name from products), 'Heineken Lata B', 'visitante na loja B: vê só o catálogo da B');

select tests.como(null, null);
select is((select count(*)::int from products), 0, 'visitante sem loja no header: não vê catálogo nenhum');
reset role;

-- ── Cliente logado ──────────────────────────────────────────
select tests.como(tests.id('cliente'), tests.id('loja_a'));
select results_eq(
  $$ select id from orders order by id $$,
  $$ values (tests.id('pedido_a1')), (tests.id('pedido_b1')) $$,
  'cliente: vê só os próprios pedidos');
select is((select count(*)::int from order_items where order_id = tests.id('pedido_a2')), 0, 'cliente: não vê itens do pedido de outra pessoa');
select is((select count(*)::int from profiles), 1, 'cliente: vê só o próprio perfil');
select is((select count(*)::int from product_costs), 0, 'cliente: não vê custos');
update orders set status = 'delivered' where id = tests.id('pedido_a1');
reset role;
select is((select status from orders where id = tests.id('pedido_a1')), 'pending', 'cliente: não consegue mudar o status do próprio pedido');

-- ── Entregador ──────────────────────────────────────────────
select tests.como(tests.id('entregador_a'), tests.id('loja_a'));
select results_eq(
  $$ select id from orders $$,
  $$ values (tests.id('pedido_a2')) $$,
  'entregador: vê só o pedido atribuído a ele');
select is((select count(*)::int from products where is_active = false), 0, 'entregador: não vê produto desativado (não é admin)');
reset role;

select * from finish();
rollback;
