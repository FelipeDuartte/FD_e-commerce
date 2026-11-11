# Testes do banco (pgTAP)

Provam as regras que ficam **dentro do banco**: uma loja nunca vê nem mexe
nos dados da outra (RLS), chaves secretas não vazam, quem pode chamar cada
função, criação de pedido e estoque, fechamento de caixa.

Rodam num **Supabase local** (Docker), montado do zero a cada execução com
a estrutura copiada do ambiente de teste — **sem nenhum dado real** e sem
encostar no teste nem na produção.

## Rodar

1. Abra o **Docker Desktop** e espere "Engine running".
2. `npm run test:db`

## Quando o banco mudar

Depois de rodar uma migration nova no ambiente de teste, atualize a cópia:

```bash
npm run test:db:estrutura
```

Ele pede a URL de conexão do **teste** (Supabase → Connect → Session pooler,
com a senha no lugar de `[YOUR-PASSWORD]`). A URL fica escondida e não é salva.

## Arquivos

| Arquivo | O que é |
|---|---|
| `supabase/migrations/00000000000000_preparar_permissoes.sql` | Faz as permissões locais ficarem iguais às do banco real |
| `supabase/migrations/00000000000001_estrutura_teste.sql` | Cópia da estrutura — **fora do Git**, gerada pelo `test:db:estrutura` |
| `supabase/migrations/00000000000002_ajudantes_testes.sql` | `tests.id('loja_a')`, `tests.como(usuario, loja)` etc. |
| `supabase/seed.sql` | Dados de exemplo: lojas A e B (com o mesmo código de produto), admins, cliente, entregador, pedidos |
| `supabase/tests/*.test.sql` | Os testes |

## Escrevendo um teste

```sql
begin;
select no_plan();

-- "Entra como" o admin da loja A, no site da loja A
select tests.como(tests.id('admin_a'), tests.id('loja_a'));
select is((select count(*)::int from products where store_id = tests.id('loja_b')), 0,
  'admin A não vê produtos da loja B');
reset role; -- volta pro postgres

select * from finish();
rollback; -- nada do teste fica gravado
```

`tests.como(null, loja)` = visitante sem login. Problemas conhecidos ficam entre
`todo_start('motivo')` e `todo_end()`: aparecem no resultado sem quebrar a suíte.
