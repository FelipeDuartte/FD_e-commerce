-- ─────────────────────────────────────────────────────────────
-- Ajudantes dos testes do banco (pgTAP) — só existem no Supabase local
-- (db-tests/). Roda depois da cópia da estrutura (00000000000001) e antes
-- do seed.sql.
-- ─────────────────────────────────────────────────────────────

create schema if not exists tests;

-- Nomes legíveis → UUIDs fixos
create table tests.ids (name text primary key, id uuid not null);
insert into tests.ids (name, id) values
  ('loja_a',        'aaaaaaaa-0000-4000-8000-000000000001'),
  ('loja_b',        'bbbbbbbb-0000-4000-8000-000000000001'),
  ('loja_inativa',  'cccccccc-0000-4000-8000-000000000001'),
  ('admin_a',       '00000000-0000-4000-8000-00000000000a'),
  ('admin_b',       '00000000-0000-4000-8000-00000000000b'),
  ('cliente',       '00000000-0000-4000-8000-00000000000c'),
  ('entregador_a',  '00000000-0000-4000-8000-00000000000d'),
  ('outro_cliente', '00000000-0000-4000-8000-00000000000e'),
  ('pedido_a1',     'a1a1a1a1-0000-4000-8000-000000000001'),
  ('pedido_a2',     'a2a2a2a2-0000-4000-8000-000000000001'),
  ('pedido_b1',     'b1b1b1b1-0000-4000-8000-000000000001'),
  ('caixa_a',       'ca1ca1ca-0000-4000-8000-000000000001'),
  ('fiado_a',       'f1f1f1f1-0000-4000-8000-000000000001'),
  ('fiado_b',       'f2f2f2f2-0000-4000-8000-000000000001'),
  ('courier_a',     'c0c0c0c0-0000-4000-8000-000000000001');

create function tests.id(p_name text) returns uuid
  language sql stable as $$ select id from tests.ids where name = p_name $$;

/**
 * "Entra como" alguém, do jeito que o Supabase faz numa requisição real:
 *   p_user  = usuário logado (null = visitante, papel anon)
 *   p_store = loja do header x-store-id (null = sem header)
 * Volta pra postgres com `reset role`.
 */
create function tests.como(p_user uuid, p_store uuid) returns void
  language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when p_user is null then '{"role":"anon"}'
         else json_build_object('sub', p_user, 'role', 'authenticated')::text end, true);
  perform set_config('request.headers',
    case when p_store is null then '{}'
         else json_build_object('x-store-id', p_store)::text end, true);
  perform set_config('role', case when p_user is null then 'anon' else 'authenticated' end, true);
end $$;

/**
 * "Entra como" alguém do jeito que o TEMPO REAL (Realtime) confere a RLS:
 * com o login (JWT), mas SEM requisição HTTP — logo, sem header x-store-id.
 */
create function tests.como_tempo_real(p_user uuid) returns void
  language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('request.headers', '', true);
  perform set_config('role', 'authenticated', true);
end $$;

/**
 * Quantas linhas da tabela quem está "logado" consegue ler. Sem permissão
 * nenhuma na tabela (erro 42501) conta como 0 — pra quem tenta ler, o
 * efeito é o mesmo: não vê nada.
 */
create function tests.linhas_visiveis(p_table text) returns int
  language plpgsql as $$
declare
  v_count int;
begin
  execute format('select count(*) from public.%I', p_table) into v_count;
  return v_count;
exception when insufficient_privilege then
  return 0;
end $$;

grant usage on schema tests to anon, authenticated, service_role;
grant select on tests.ids to anon, authenticated, service_role;
grant execute on all functions in schema tests to anon, authenticated, service_role;

