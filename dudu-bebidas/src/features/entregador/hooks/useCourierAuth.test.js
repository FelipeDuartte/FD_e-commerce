// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Supabase de mentira: sessão controlada pelo teste e tabela couriers por usuário
const fake = vi.hoisted(() => ({
  session: null,
  couriers: {}, // user_id → linha de couriers
  onAuthChange: null,
  pending: [], // buscas em andamento (pra testar a troca de login no meio)
  holdLookups: false,
}));

vi.mock("../../../shared/supabase/Supabaseclient", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: fake.session } }),
      onAuthStateChange: (cb) => {
        fake.onAuthChange = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signInWithPassword: async () => ({ error: null }),
      signOut: async () => {},
    },
    from: () => {
      let userId;
      const builder = {
        select: () => builder,
        eq: (_col, value) => {
          userId = value;
          return builder;
        },
        maybeSingle: () => {
          const result = { data: fake.couriers[userId] ?? null };
          if (!fake.holdLookups) return Promise.resolve(result);
          return new Promise((resolve) => fake.pending.push(() => resolve(result)));
        },
      };
      return builder;
    },
  },
}));

const { useCourierAuth } = await import("./useCourierAuth");

const sessionFor = (id) => ({ user: { id } });
const login = (id) => act(() => fake.onAuthChange("SIGNED_IN", sessionFor(id)));

beforeEach(() => {
  fake.session = null;
  fake.couriers = {
    "user-carlos": { id: "c1", name: "Carlos", phone: "31999990000", is_active: true },
    "user-inativo": { id: "c2", name: "Ex-entregador", phone: "", is_active: false },
  };
  fake.pending = [];
  fake.holdLookups = false;
});

describe("useCourierAuth", () => {
  it("começa 'verificando' (undefined) enquanto lê a sessão", () => {
    const { result } = renderHook(() => useCourierAuth());
    expect(result.current.courier).toBeUndefined();
  });

  it("sem login: acesso negado (false)", async () => {
    const { result } = renderHook(() => useCourierAuth());
    await waitFor(() => expect(result.current.courier).toBe(false));
  });

  it("entregador ativo: devolve o cadastro", async () => {
    fake.session = sessionFor("user-carlos");
    const { result } = renderHook(() => useCourierAuth());
    await waitFor(() => expect(result.current.courier).toMatchObject({ name: "Carlos" }));
  });

  it("entregador desativado: acesso negado", async () => {
    fake.session = sessionFor("user-inativo");
    const { result } = renderHook(() => useCourierAuth());
    await waitFor(() => expect(result.current.courier).toBe(false));
  });

  it("logado sem cadastro de entregador (ex: cliente do site): acesso negado", async () => {
    fake.session = sessionFor("user-cliente");
    const { result } = renderHook(() => useCourierAuth());
    await waitFor(() => expect(result.current.courier).toBe(false));
  });

  it("trocar de login nunca mostra o entregador do login anterior", async () => {
    fake.session = sessionFor("user-carlos");
    const { result } = renderHook(() => useCourierAuth());
    await waitFor(() => expect(result.current.courier).toMatchObject({ name: "Carlos" }));

    fake.holdLookups = true; // a busca do novo login fica "no ar"
    login("user-inativo");
    expect(result.current.courier).toBeUndefined(); // verificando — não "Carlos"

    await act(async () => fake.pending.forEach((resolve) => resolve()));
    expect(result.current.courier).toBe(false);
  });

  it("sair: volta para acesso negado", async () => {
    fake.session = sessionFor("user-carlos");
    const { result } = renderHook(() => useCourierAuth());
    await waitFor(() => expect(result.current.courier).toMatchObject({ name: "Carlos" }));
    act(() => fake.onAuthChange("SIGNED_OUT", null));
    expect(result.current.courier).toBe(false);
  });
});
