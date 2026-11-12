// Supabase de mentira pros testes das edge functions: devolve respostas
// fixas por tabela/rpc e registra o que a function pediu (tabela, filtros,
// rpc + parâmetros) pro teste conferir. Só a fatia da API que as functions
// usam: from().select()/update().eq().in().order().limit()
// .maybeSingle()/single() (ou await direto) e rpc().
//
// Não é importado por nenhum index.ts — nunca vai junto no deploy.

type Result = { data: unknown; error: unknown };

export interface FakeQuery {
  table: string;
  filters: Record<string, unknown>;
  update?: Record<string, unknown>; // valores de um .update()
}

export interface FakeSupabase {
  from(table: string): unknown;
  rpc(name: string, params?: Record<string, unknown>): Promise<Result>;
  queries: FakeQuery[];
  rpcCalls: { name: string; params?: Record<string, unknown> }[];
}

const ok = (data: unknown): Result => ({ data, error: null });

/**
 * @param tables resposta por tabela — valor puro vira { data, error: null };
 *               passe { data, error } pra simular erro do banco
 * @param rpcs   resposta por nome de rpc (padrão: { data: null, error: null })
 */
export function createFakeSupabase(
  tables: Record<string, unknown> = {},
  rpcs: Record<string, Result> = {},
): FakeSupabase {
  const queries: FakeQuery[] = [];
  const rpcCalls: FakeSupabase["rpcCalls"] = [];

  const resultFor = (table: string): Result => {
    const value = tables[table];
    if (value && typeof value === "object" && "data" in value && "error" in value) return value as Result;
    return ok(value ?? null);
  };

  return {
    from(table: string) {
      const query: FakeQuery = { table, filters: {} };
      queries.push(query);
      const result = () => Promise.resolve(resultFor(table));
      const builder = {
        select: () => builder,
        update: (values: Record<string, unknown>) => {
          query.update = values;
          return builder;
        },
        eq: (column: string, value: unknown) => {
          query.filters[column] = value;
          return builder;
        },
        neq: () => builder,
        in: () => builder,
        gte: () => builder,
        order: () => builder,
        limit: () => builder,
        maybeSingle: result,
        single: result,
        then: (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) => result().then(resolve, reject),
      };
      return builder;
    },
    rpc(name: string, params?: Record<string, unknown>) {
      rpcCalls.push({ name, params });
      return Promise.resolve(rpcs[name] ?? ok(null));
    },
    queries,
    rpcCalls,
  };
}

/** Requisição JSON pros handlers. */
export function jsonRequest(
  body: unknown,
  { url = "https://fn.test/", headers = {}, method = "POST" }: { url?: string; headers?: Record<string, string>; method?: string } = {},
): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: method === "GET" || method === "OPTIONS" ? undefined : JSON.stringify(body),
  });
}
