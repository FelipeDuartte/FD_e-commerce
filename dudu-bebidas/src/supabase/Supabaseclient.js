import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────
// MULTI-LOJA
//
// Cada projeto Vercel (dudu-bebidas, adega-premium, ...) define sua própria
// loja através da env var VITE_STORE_SLUG. Esse client:
//   1) resolve o slug → { id, name, type, whatsapp } uma única vez, no boot
//      do app (ver resolveStore(), chamado em main.jsx antes de renderizar);
//   2) a partir daí, injeta automaticamente o header "x-store-id" em TODA
//      chamada ao Supabase (select/insert/update/delete/rpc/functions).
//
// É esse header que a RLS do banco usa pra isolar os dados de cada loja
// (função current_store_id() em sql/04_rls_policies.sql). Sem ele, nenhuma
// leitura pública funciona — por isso resolveStore() precisa terminar ANTES
// de qualquer outro componente/hook disparar uma query.
// ─────────────────────────────────────────────────────────────

const STORE_SLUG = import.meta.env.VITE_STORE_SLUG;

if (!STORE_SLUG) {
  console.error(
    "[Supabaseclient] VITE_STORE_SLUG não definida. Configure essa env var " +
    "no projeto Vercel desta loja (Project Settings → Environment Variables).",
  );
}

let cachedStore = null; // { id, slug, name, type, whatsapp }

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY,
  {
    global: {
      fetch: (url, options = {}) => {
        const headers = new Headers(options.headers);
        if (cachedStore?.id) headers.set("x-store-id", cachedStore.id);
        return fetch(url, { ...options, headers });
      },
    },
  },
);

/**
 * Resolve a loja atual a partir de VITE_STORE_SLUG. Chame isso UMA VEZ no
 * boot do app (main.jsx), antes de montar <App />. Fica em cache — chamadas
 * seguintes retornam na hora, sem nova consulta.
 *
 * @throws {Error} se o slug não existir ou a loja estiver inativa — nesse
 * caso, mostre uma tela de erro em vez de renderizar o app (ver main.jsx).
 */
export async function resolveStore() {
  if (cachedStore) return cachedStore;

  const { data, error } = await supabase
    .from("stores")
    .select("id, slug, name, type, whatsapp")
    .eq("slug", STORE_SLUG)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    throw new Error(`Loja "${STORE_SLUG}" não encontrada ou inativa.`);
  }

  cachedStore = data;
  return data;
}

/** Retorna a loja já resolvida, ou null se resolveStore() ainda não rodou. */
export function getCurrentStore() {
  return cachedStore;
}

/** Atalho para o id da loja atual — usado nos payloads de insert do admin. */
export function getCurrentStoreId() {
  return cachedStore?.id ?? null;
}

// login com google
export const loginGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      // Antes era fixo em "https://dudu-bebidas.vercel.app" — agora usa o
      // domínio de quem está logando, então funciona em qualquer projeto
      // (dudu-bebidas.vercel.app, adega-premium.vercel.app, preview deploys...).
      redirectTo: window.location.origin,
    },
  });

  if (error) console.log(error);
};
