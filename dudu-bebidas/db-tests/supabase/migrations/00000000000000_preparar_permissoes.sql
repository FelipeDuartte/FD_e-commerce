-- ─────────────────────────────────────────────────────────────
-- Roda ANTES da cópia da estrutura (00000000000001).
--
-- O Supabase local dá permissão automática (default privileges) pra anon
-- e authenticated em toda tabela/função criada. A cópia (pg_dump) só traz
-- as permissões que o banco real tem — não tira as que o Supabase local
-- acrescenta. Sem isto, funções que no banco real são só do service_role
-- (ex: create_order_atomic) ficariam liberadas pra qualquer visitante aqui,
-- e os testes de permissão não valeriam nada.
--
-- A própria cópia, no final, recoloca as permissões automáticas exatamente
-- como estão no banco real.
-- ─────────────────────────────────────────────────────────────

alter default privileges for role postgres in schema public revoke all on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, service_role;
