-- Por padrão, uma view no Postgres roda com a permissão de quem CRIOU ela
-- (o role da migration), não de quem está consultando — o que furaria o
-- isolamento entre lojas (is_store_admin) nas tabelas de baixo dessa view.
-- security_invoker faz a RLS ser avaliada com o usuário que está consultando
-- de verdade, mesmo comportamento das outras tabelas admin-only do sistema.
ALTER VIEW public.pdv_customer_balances SET (security_invoker = true);
