import { createClient } from "@supabase/supabase-js";

// Multi-loja: o PDV é UM aplicativo para todas as lojas. A loja não vem
// mais do build — vem do login: depois que o operador entra, App.jsx lê a
// loja do perfil dele (profiles.store_id) e chama loadStore(). A partir
// daí toda chamada leva o header "x-store-id", que a RLS usa pra isolar os
// dados dessa loja.

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

/** Carrega a loja do operador logado. Lança erro se não existir ou estiver inativa. */
export async function loadStore(storeId) {
  const { data, error } = await supabase
    .from("stores")
    .select("id, slug, name, type, whatsapp, phone, logo_url, pickup_address, pickup_address_detail")
    .eq("id", storeId)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    throw new Error("Loja não encontrada ou inativa.");
  }

  cachedStore = data;
  // Baixa o logo da notinha já agora: a impressão sai ~60ms depois do
  // clique, sem tempo de buscar a imagem na hora.
  if (data.logo_url) new Image().src = data.logo_url;
  return data;
}

export function clearStore() {
  cachedStore = null;
}

export function getCurrentStoreId() {
  return cachedStore?.id ?? null;
}

/** Retorna a loja já carregada (id, slug, name...), ou null antes do login. */
export function getCurrentStore() {
  return cachedStore;
}


