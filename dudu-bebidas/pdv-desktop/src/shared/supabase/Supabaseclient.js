import { createClient } from "@supabase/supabase-js";

// Mesmo esquema multi-loja do site principal (ver src/supabase/Supabaseclient.js
// do app web): resolve o slug → { id, ... } uma vez no boot (main.jsx) e injeta
// "x-store-id" em toda chamada, pra RLS isolar os dados dessa loja.
const STORE_SLUG = import.meta.env.VITE_STORE_SLUG;

if (!STORE_SLUG) {
  console.error("[Supabaseclient] VITE_STORE_SLUG não definida (arquivo .env).");
}

let cachedStore = null;

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

export function getCurrentStoreId() {
  return cachedStore?.id ?? null;
}

/** Retorna a loja já resolvida (id, slug, name...), ou null se resolveStore() ainda não rodou. */
export function getCurrentStore() {
  return cachedStore;
}
