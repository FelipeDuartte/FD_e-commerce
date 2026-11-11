-- Fechamento de caixa (close_cash_session): o dinheiro esperado na gaveta
-- é o troco inicial + o que entrou EM DINHEIRO (venda, parte em dinheiro
-- do pagamento dividido e pagamento de fiado). Cancelados não contam.
begin;
select no_plan();

-- Vendas do caixa A (troco inicial R$ 100,00)
insert into orders (id, store_id, total, payment_method, address, status, channel, cash_session_id, pdv_customer_id) values
  ('00000000-0000-4000-8000-0000000000f1', tests.id('loja_a'), 20.00, 'cash',  '{}', 'delivered', 'balcao', tests.id('caixa_a'), null),
  ('00000000-0000-4000-8000-0000000000f2', tests.id('loja_a'), 15.00, 'pix',   '{}', 'delivered', 'balcao', tests.id('caixa_a'), null),
  ('00000000-0000-4000-8000-0000000000f3', tests.id('loja_a'), 15.00, 'misto', '{}', 'delivered', 'balcao', tests.id('caixa_a'), null),
  ('00000000-0000-4000-8000-0000000000f4', tests.id('loja_a'), 30.00, 'fiado', '{}', 'delivered', 'balcao', tests.id('caixa_a'), tests.id('fiado_a')),
  ('00000000-0000-4000-8000-0000000000f5', tests.id('loja_a'), 50.00, 'cash',  '{}', 'cancelled', 'balcao', tests.id('caixa_a'), null);

-- Pagamento dividido: R$ 10 em dinheiro + R$ 5 no crédito
insert into order_payments (order_id, store_id, method, amount) values
  ('00000000-0000-4000-8000-0000000000f3', tests.id('loja_a'), 'cash', 10.00),
  ('00000000-0000-4000-8000-0000000000f3', tests.id('loja_a'), 'credit_card', 5.00);

-- Cliente do fiado pagou R$ 7 em dinheiro neste caixa
insert into pdv_customer_payments (store_id, customer_id, amount, payment_method, cash_session_id) values
  (tests.id('loja_a'), tests.id('fiado_a'), 7.00, 'cash', tests.id('caixa_a'));

select throws_like(
  $$ insert into pdv_customer_payments (store_id, customer_id, amount, payment_method, cash_session_id)
     values (tests.id('loja_a'), tests.id('fiado_a'), 50.00, 'cash', tests.id('caixa_a')) $$,
  '%maior que a dívida do cliente (R$ 23,00)%',
  'fiado: não aceita receber mais do que o cliente deve (deve 30 − 7 = 23)');

-- ── Fechamento ──────────────────────────────────────────────
select tests.como(tests.id('admin_a'), tests.id('loja_a'));
create temp table fechamento as select public.close_cash_session(tests.id('caixa_a'), 135.00) as r;

select is((select (r->>'expected')::numeric from fechamento), 137.00,
  'esperado na gaveta = 100 (troco) + 20 (dinheiro) + 10 (parte em dinheiro) + 7 (fiado pago)');
select is((select (r->>'difference')::numeric from fechamento), -2.00, 'contou R$ 135: faltam R$ 2,00');
select is((select (r->>'fiado_total')::numeric from fechamento), 30.00, 'total vendido no fiado aparece separado');
select results_eq(
  $$ select e->>'method', (e->>'amount')::numeric
       from fechamento, jsonb_array_elements(r->'breakdown') e order by 1 $$,
  $$ values ('cash', 37.00::numeric), ('credit_card', 5.00), ('pix', 15.00) $$,
  'resumo por forma de pagamento (sem o cancelado e sem o fiado)');

select is(public.close_cash_session(tests.id('caixa_a'), 137.00)->>'error', 'Caixa já está fechado.',
  'não fecha o mesmo caixa duas vezes');
reset role;

select is((select status from cash_sessions where id = tests.id('caixa_a')), 'closed', 'caixa fechado');
select is((select closing_amount_expected from cash_sessions where id = tests.id('caixa_a')), 137.00, 'esperado gravado no caixa');
select is((select closed_by from cash_sessions where id = tests.id('caixa_a')), tests.id('admin_a'), 'registra quem fechou');

select * from finish();
rollback;
