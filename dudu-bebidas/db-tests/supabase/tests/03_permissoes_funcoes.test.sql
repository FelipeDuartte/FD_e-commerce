-- Quem pode chamar cada função do banco. Funções que gravam pedido,
-- confirmam pagamento ou mexem em estoque são só das edge functions
-- (service role); as de admin conferem a loja de quem chama.
--
-- ATENÇÃO: aqui a permissão é conferida com has_function_privilege, sem
-- CHAMAR a função bloqueada. No Postgres local do Mac (imagem ARM
-- supabase/postgres 17.6.1.106), "permission denied" ao chamar função
-- derruba o servidor (segfault). A versão do Supabase de verdade (17.6.1.063,
-- x86) responde o erro normalmente — testado em 2026-11-09.
begin;
select no_plan();

-- ── Só as edge functions (service role) ─────────────────────
select ok(not has_function_privilege(r, f, 'execute'), format('%s não executa %s', r, f))
  from unnest(array['anon', 'authenticated']) as r,
       unnest(array[
         'public.create_order_atomic(uuid, jsonb, jsonb, jsonb, boolean)',
         'public.confirm_mercadopago_payment(uuid, uuid, text)',
         'public.delete_rejected_mercadopago_order(uuid, uuid)',
         'public.mark_mercadopago_payment_failed(uuid, uuid, text, text)',
         'public.restore_stock(uuid, uuid)',
         'public.pdv_adjust_product_stock(uuid, text, integer, text, uuid)',
         'public.pdv_customer_debt(uuid, uuid)',
         'public.process_order(uuid, uuid, jsonb)'
       ]) as f;

-- ── Funções de admin: visitante nem consegue chamar ─────────
select ok(not has_function_privilege('anon', f, 'execute'), format('visitante não executa %s', f))
  from unnest(array[
    'public.close_cash_session(uuid, numeric)',
    'public.reject_order(uuid, uuid)',
    'public.mark_order_paid(uuid, uuid)',
    'public.promote_store_admin(text)',
    'public.register_product_purchase(uuid, text, integer, numeric)',
    'public.cancel_pdv_sale(uuid, uuid)',
    'public.settle_fiado_stock(uuid, uuid)'
  ]) as f;

-- ── Admin da loja B tentando agir na loja A ─────────────────
select tests.como(tests.id('admin_b'), tests.id('loja_b'));
select is(public.reject_order(tests.id('pedido_a1'), tests.id('loja_a'))->>'error', 'Sem permissão.',
  'admin B: não rejeita pedido da loja A');
select is(public.reject_order(tests.id('pedido_a1'), tests.id('loja_b'))->>'error', 'Pedido não pertence a esta loja.',
  'admin B: não rejeita pedido da A passando a própria loja');
select is(public.mark_order_paid(tests.id('pedido_a1'), tests.id('loja_b'))->>'error', 'Pedido não pertence a esta loja.',
  'admin B: não marca como pago pedido da loja A');
select is(public.close_cash_session(tests.id('caixa_a'), 0)->>'error', 'Sem permissão.',
  'admin B: não fecha o caixa da loja A');
reset role;
select is((select status from orders where id = tests.id('pedido_a1')), 'pending', 'pedido da loja A continua pendente');
select is((select payment_status from orders where id = tests.id('pedido_a1')), 'pago', 'pagamento do pedido A não foi alterado');
select is((select status from cash_sessions where id = tests.id('caixa_a')), 'open', 'caixa da loja A continua aberto');

-- ── Cliente comum chamando função de admin ──────────────────
select tests.como(tests.id('cliente'), tests.id('loja_a'));
select is(public.reject_order(tests.id('pedido_a1'), tests.id('loja_a'))->>'error', 'Sem permissão.',
  'cliente: não rejeita pedido (nem o próprio)');
reset role;


select * from finish();
rollback;
