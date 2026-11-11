-- Chaves de pagamento, token da Meta e custos nunca chegam a quem não é
-- admin da loja — nem por tabela, nem por função pública.
begin;
select no_plan();

-- ── Tabelas com segredo ─────────────────────────────────────
select tests.como(null, tests.id('loja_a'));
select is(tests.linhas_visiveis('store_payment_configs'), 0, 'visitante: não lê chaves de pagamento');
select is(tests.linhas_visiveis('whatsapp_configs'), 0, 'visitante: não lê o token da Meta');
select is(tests.linhas_visiveis('whatsapp_inbound_messages'), 0, 'visitante: não lê o registro do chatbot');
select is(tests.linhas_visiveis('store_order_counters'), 0, 'visitante: não lê contadores internos');
select is(tests.linhas_visiveis('product_costs'), 0, 'visitante: não lê custos');

select tests.como(tests.id('cliente'), tests.id('loja_a'));
select is(tests.linhas_visiveis('store_payment_configs'), 0, 'cliente logado: não lê chaves de pagamento');
select is(tests.linhas_visiveis('whatsapp_configs'), 0, 'cliente logado: não lê o token da Meta');

select tests.como(tests.id('admin_a'), tests.id('loja_a'));
select is(tests.linhas_visiveis('store_payment_configs'), 1, 'admin A: lê a configuração de pagamento da própria loja');
select is((select count(*)::int from store_payment_configs where store_id = tests.id('loja_b')), 0, 'admin A: não lê a da loja B');
select is(tests.linhas_visiveis('whatsapp_configs'), 0, 'admin: o token da Meta só é lido pelas edge functions (service role)');
update store_payment_configs set pix_key = 'golpe@pix' where store_id = tests.id('loja_b');
reset role;
select is((select pix_key from store_payment_configs where store_id = tests.id('loja_b')), 'pix-b@teste.local', 'admin A: não troca a chave Pix da loja B');

-- ── Funções públicas não vazam segredo ──────────────────────
select tests.como(null, tests.id('loja_a'));
select ok(
  public.get_mercadopago_public_config(tests.id('loja_a'))::text not like '%SECRETO%',
  'config pública do Mercado Pago: não devolve access token nem segredo do webhook');

select is(
  (public.get_order_status(tests.id('pedido_a1'), tests.id('loja_b')))->>'success', 'false',
  'status do pedido: com a loja errada, "não encontrado"');
select is(
  (public.get_order_status(tests.id('pedido_a1'), tests.id('loja_a')))->>'status', 'pending',
  'status do pedido: quem tem o código do pedido vê o status');
select ok(
  not (public.get_order_status(tests.id('pedido_a1'), tests.id('loja_a')) ? 'address'),
  'status do pedido: não devolve o endereço do cliente');

select ok(
  not (public.get_order_status(tests.id('pedido_a2'), tests.id('loja_a')) ? 'courier_phone'),
  'status do pedido: não devolve o telefone pessoal do entregador');
select is(
  (public.get_order_status(tests.id('pedido_a2'), tests.id('loja_a')))->>'courier_name', 'Carlos',
  'status do pedido: mostra o nome do entregador');
reset role;

select * from finish();
rollback;
