import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "./testing/fakeSupabase.ts";

// createClient de mentira: cada client criado guarda os headers usados e
// responde com o usuário/perfil do cenário.
const scenario = vi.hoisted(() => ({
  user: null as null | { id: string },
  profile: null as unknown,
  clients: [] as { headers: Record<string, string> }[],
}));

vi.mock("https://esm.sh/@supabase/supabase-js@2", () => ({
  createClient: (_url: string, _key: string, options?: { global?: { headers?: Record<string, string> } }) => {
    const headers = options?.global?.headers ?? {};
    scenario.clients.push({ headers });
    const db = createFakeSupabase({ profiles: scenario.profile });
    return {
      headers,
      auth: { getUser: async () => ({ data: { user: scenario.user } }) },
      from: db.from,
    };
  },
}));

const { requireStoreAdmin } = await import("./authGuard.ts");

const request = (authorization?: string) =>
  new Request("https://fn.test/", { headers: authorization ? { Authorization: authorization } : {} });

beforeEach(() => {
  vi.stubGlobal("Deno", { env: { get: (k: string) => `env-${k}` } });
  scenario.user = { id: "user-1" };
  scenario.profile = { is_admin: true, store_id: "store-a" };
  scenario.clients = [];
});

describe("requireStoreAdmin", () => {
  it("admin da loja: devolve usuário e loja do perfil", async () => {
    const admin = await requireStoreAdmin(request("Bearer jwt-admin"));
    expect(admin).toMatchObject({ userId: "user-1", storeId: "store-a" });
  });

  it("o client devolvido já vai com o login e a loja (x-store-id) pro RLS", async () => {
    const admin = await requireStoreAdmin(request("Bearer jwt-admin"));
    expect((admin?.client as unknown as { headers: Record<string, string> }).headers).toEqual({
      Authorization: "Bearer jwt-admin",
      "x-store-id": "store-a",
    });
  });

  it("sem login (só a anon key): null", async () => {
    scenario.user = null;
    expect(await requireStoreAdmin(request("Bearer anon-key"))).toBeNull();
  });

  it("sem header Authorization: null", async () => {
    scenario.user = null;
    expect(await requireStoreAdmin(request())).toBeNull();
  });

  it("logado mas não é admin: null", async () => {
    scenario.profile = { is_admin: false, store_id: "store-a" };
    expect(await requireStoreAdmin(request("Bearer jwt"))).toBeNull();
  });

  it("admin sem loja vinculada: null", async () => {
    scenario.profile = { is_admin: true, store_id: null };
    expect(await requireStoreAdmin(request("Bearer jwt"))).toBeNull();
  });

  it("sem perfil: null", async () => {
    scenario.profile = null;
    expect(await requireStoreAdmin(request("Bearer jwt"))).toBeNull();
  });
});
