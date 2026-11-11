-- Tempo real (Realtime) confere a RLS de cada mudança SEM requisição HTTP
-- (sem header x-store-id). Regras que dependem de current_store_id()
-- descartavam os eventos em silêncio e o PDV parava de atualizar sozinho
-- (Clientes, Produtos, Caixa, Estoque, Contas a pagar). Ver migration 0056.
begin;
select no_plan();

-- ── Sem requisição HTTP: loja do admin logado ───────────────
select tests.como_tempo_real(tests.id('admin_a'));
select is(public.current_store_id(), tests.id('loja_a'), 'tempo real, admin A: loja A');
select is((select count(*)::int from pdv_customer_payments where store_id <> tests.id('loja_a')), 0, 'tempo real, admin A: nada de outra loja');
select is(tests.linhas_visiveis('pdv_customers'), 1, 'tempo real, admin A: vê os clientes do fiado da própria loja');
select is(tests.linhas_visiveis('cash_sessions'), 1, 'tempo real, admin A: vê o caixa da própria loja');
select is((select count(*)::int from products), 3, 'tempo real, admin A: vê os produtos da própria loja');

select tests.como_tempo_real(tests.id('admin_b'));
select is(public.current_store_id(), tests.id('loja_b'), 'tempo real, admin B: loja B');
select is((select count(*)::int from pdv_customers where store_id = tests.id('loja_a')), 0, 'tempo real, admin B: não vê clientes do fiado da A');
select is((select count(*)::int from cash_sessions where store_id = tests.id('loja_a')), 0, 'tempo real, admin B: não vê o caixa da A');

select tests.como_tempo_real(tests.id('cliente'));
select is(public.current_store_id(), null, 'tempo real, cliente (não admin): sem loja');
select is(tests.linhas_visiveis('pdv_customers'), 0, 'tempo real, cliente: não vê clientes do fiado');
reset role;

-- ── Com requisição HTTP: o header continua mandando ─────────
select tests.como(tests.id('admin_a'), tests.id('loja_b'));
select is(public.current_store_id(), tests.id('loja_b'), 'requisição normal: vale o header (não a loja do perfil)');
select is(tests.linhas_visiveis('pdv_customers'), 0, 'admin A no site da B continua sem ver clientes do fiado');

select tests.como(null, null);
select is(public.current_store_id(), null, 'visitante sem header: sem loja');
reset role;

select * from finish();
rollback;
