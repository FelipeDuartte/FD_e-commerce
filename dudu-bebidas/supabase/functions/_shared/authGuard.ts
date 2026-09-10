// ─────────────────────────────────────────────────────────────
// Helper compartilhado: confirma que quem chamou a Edge Function
// está autenticado E é admin de alguma loja.
//
// `verify_jwt = true` no config.toml só garante que o token é
// válido (inclusive a anon key, que também é um JWT assinado) —
// não garante que é um usuário logado, muito menos um admin.
// Use isto sempre que a function fizer algo que só admin deveria
// poder disparar (upload, busca autenticada, etc).
// ─────────────────────────────────────────────────────────────

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface StoreAdmin {
  userId: string;
  storeId: string;
  client: SupabaseClient;
}

export async function requireStoreAdmin(req: Request): Promise<StoreAdmin | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;

  const { data: profile } = await client
    .from("profiles")
    .select("is_admin, store_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin || !profile.store_id) return null;

  // Várias policies (ver cash_sessions_admin_all, produtos etc.) agora exigem
  // `store_id = current_store_id()` além de is_store_admin(store_id) —
  // current_store_id() lê o header x-store-id (mesmo mecanismo que o
  // Supabaseclient.js do front injeta em toda chamada). O client acima não
  // manda esse header (ainda não sabíamos o store_id no momento de criá-lo),
  // então qualquer query feita com ele falharia nessa segunda condição.
  // Client novo, já com o header certo, pra devolver pro caller.
  const scopedClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader, "x-store-id": profile.store_id } } },
  );

  return { userId: user.id, storeId: profile.store_id, client: scopedClient };
}
