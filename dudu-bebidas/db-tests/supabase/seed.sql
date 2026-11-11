-- ─────────────────────────────────────────────────────────────
-- Dados de exemplo dos testes do banco (pgTAP). Rodam só no Supabase
-- local (db-tests/), recriado do zero a cada `npm run test:db`.
-- Nenhum dado real: duas lojas de mentira, com o MESMO código de produto
-- de propósito (pra provar que uma loja nunca enxerga/mexe na outra).
-- ─────────────────────────────────────────────────────────────

-- ── Lojas ────────────────────────────────────────────────────
insert into public.stores (id, slug, name, type, whatsapp, is_active) values
  (tests.id('loja_a'), 'loja-a', 'Loja A', 'bebidas', '31999990001', true),
  (tests.id('loja_b'), 'loja-b', 'Loja B', 'varejo', '31999990002', true),
  (tests.id('loja_inativa'), 'loja-inativa', 'Loja Inativa', 'bebidas', null, false);

-- ── Usuários ─────────────────────────────────────────────────
insert into auth.users (id, email, aud, role) values
  (tests.id('admin_a'), 'admin-a@teste.local', 'authenticated', 'authenticated'),
  (tests.id('admin_b'), 'admin-b@teste.local', 'authenticated', 'authenticated'),
  (tests.id('cliente'), 'cliente@teste.local', 'authenticated', 'authenticated'),
  (tests.id('entregador_a'), 'entregador@teste.local', 'authenticated', 'authenticated'),
  (tests.id('outro_cliente'), 'outro@teste.local', 'authenticated', 'authenticated');

insert into public.profiles (id, email, is_admin, store_id) values
  (tests.id('admin_a'), 'admin-a@teste.local', true, tests.id('loja_a')),
  (tests.id('admin_b'), 'admin-b@teste.local', true, tests.id('loja_b')),
  (tests.id('cliente'), 'cliente@teste.local', false, null),
  (tests.id('entregador_a'), 'entregador@teste.local', false, null),
  (tests.id('outro_cliente'), 'outro@teste.local', false, null);

insert into public.couriers (id, store_id, user_id, name, phone, is_active) values
  (tests.id('courier_a'), tests.id('loja_a'), tests.id('entregador_a'), 'Carlos', '31988887777', true);

-- ── Produtos (mesmo código "heineken" nas duas lojas) ────────
insert into public.products (store_id, id, name, category, price, stock, is_active) values
  (tests.id('loja_a'), 'heineken', 'Heineken Lata', 'cerveja', 6.00, 10, true),
  (tests.id('loja_a'), 'brahma', 'Brahma 600ml', 'cerveja', 8.50, 5, true),
  (tests.id('loja_a'), 'desativado', 'Produto Desativado', 'outros', 1.00, 3, false),
  (tests.id('loja_b'), 'heineken', 'Heineken Lata B', 'cerveja', 5.50, 50, true);

insert into public.product_costs (store_id, product_id, cost_price, supplier) values
  (tests.id('loja_a'), 'heineken', 3.20, 'Distribuidora A'),
  (tests.id('loja_b'), 'heineken', 3.00, 'Distribuidora B');

-- ── Configurações com segredo (chaves falsas) ────────────────
insert into public.store_payment_configs (store_id, pix_key, pix_key_type, mercadopago_access_token, mercadopago_webhook_secret) values
  (tests.id('loja_a'), 'pix-a@teste.local', 'email', 'TOKEN-SECRETO-A', 'WEBHOOK-SECRETO-A'),
  (tests.id('loja_b'), 'pix-b@teste.local', 'email', 'TOKEN-SECRETO-B', 'WEBHOOK-SECRETO-B');

insert into public.whatsapp_configs (store_id, phone_number_id, access_token) values
  (tests.id('loja_a'), '111', 'META-TOKEN-SECRETO-A');

-- ── Clientes do fiado ────────────────────────────────────────
insert into public.pdv_customers (id, store_id, name, phone) values
  (tests.id('fiado_a'), tests.id('loja_a'), 'João do Fiado A', '31977776666'),
  (tests.id('fiado_b'), tests.id('loja_b'), 'Maria do Fiado B', '31966665555');

-- ── Caixa aberto na loja A ───────────────────────────────────
insert into public.cash_sessions (id, store_id, opened_by, opening_amount, status) values
  (tests.id('caixa_a'), tests.id('loja_a'), tests.id('admin_a'), 100.00, 'open');

-- ── Pedidos ──────────────────────────────────────────────────
-- A1: pedido do site do cliente, pendente (2 Heineken)
-- A2: pedido de outro cliente, saiu pra entrega com o entregador A
-- B1: pedido do cliente na loja B
insert into public.orders (id, store_id, user_id, total, payment_method, address, status, channel, courier_id, courier_name, courier_phone) values
  (tests.id('pedido_a1'), tests.id('loja_a'), tests.id('cliente'), 12.00, 'pix', '{"name":"Cliente","phone":"31911112222"}', 'pending', 'online', null, null, null),
  (tests.id('pedido_a2'), tests.id('loja_a'), tests.id('outro_cliente'), 8.50, 'cash', '{"name":"Outro","phone":"31933334444"}', 'on_the_way', 'online', tests.id('courier_a'), 'Carlos', '31988887777'),
  (tests.id('pedido_b1'), tests.id('loja_b'), tests.id('cliente'), 11.00, 'pix', '{"name":"Cliente","phone":"31911112222"}', 'pending', 'online', null, null, null);

insert into public.order_items (order_id, product_id, name, price, quantity) values
  (tests.id('pedido_a1'), 'heineken', 'Heineken Lata', 6.00, 2),
  (tests.id('pedido_a2'), 'brahma', 'Brahma 600ml', 8.50, 1),
  (tests.id('pedido_b1'), 'heineken', 'Heineken Lata B', 5.50, 2);
