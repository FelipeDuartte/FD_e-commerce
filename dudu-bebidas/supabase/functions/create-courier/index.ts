// ─────────────────────────────────────────────────────────────
// Edge Function: create-courier
//
// Cria o login de um entregador (e-mail + senha definida pelo admin) e a
// linha correspondente em couriers. Só admin da própria loja pode chamar —
// entregadores são poucos e fixos, cadastrados manualmente pelo admin, sem
// auto-cadastro/convite por e-mail.
//
// Body esperado: { "name": "...", "phone": "...", "email": "...", "password": "..." }
//
// Nota: se o e-mail já pertencer a outra conta (ex: o entregador já é
// cliente cadastrado no site), auth.admin.createUser falha e isso sobe
// como erro pro admin — a orientação é usar um e-mail próprio pro trabalho,
// não tentar linkar uma conta de cliente existente (fora do escopo desta
// fase).
// ─────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireStoreAdmin } from "../_shared/authGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-store-id",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const admin = await requireStoreAdmin(req);
    if (!admin) {
      return jsonResponse({ error: "Acesso restrito a administradores de loja." }, 403);
    }

    const { name, phone, email, password } = await req.json();

    if (!name?.trim()) return jsonResponse({ error: "Informe o nome do entregador." }, 400);
    if (!email?.trim()) return jsonResponse({ error: "Informe o e-mail do entregador." }, 400);
    if (!password || password.length < 6) {
      return jsonResponse({ error: "A senha precisa ter pelo menos 6 caracteres." }, 400);
    }

    // Service role: precisa criar usuário no Auth diretamente com senha
    // definida na hora (sem fluxo de confirmação por e-mail), e inserir em
    // couriers (que não tem policy de INSERT pra ninguém além disso).
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: authUser, error: authError } = await serviceClient.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
    });

    if (authError || !authUser?.user) {
      return jsonResponse({ error: authError?.message ?? "Não foi possível criar o login." }, 400);
    }

    const { data: courier, error: courierError } = await serviceClient
      .from("couriers")
      .insert({
        store_id: admin.storeId,
        user_id: authUser.user.id,
        name: name.trim(),
        phone: phone?.trim() || null,
      })
      .select("id, name, phone, is_active, created_at")
      .single();

    if (courierError) {
      // Login já foi criado no Auth — sem isso o admin ficaria com um
      // usuário órfão sem saber. Remove pra manter consistente e permitir
      // tentar de novo com o mesmo e-mail.
      await serviceClient.auth.admin.deleteUser(authUser.user.id);
      console.error("[create-courier] Erro ao inserir courier:", courierError);
      return jsonResponse({ error: "Não foi possível cadastrar o entregador." }, 400);
    }

    return jsonResponse({ courier }, 200);
  } catch (err) {
    console.error("[create-courier] Erro inesperado:", err);
    return jsonResponse({ error: "Erro interno do servidor." }, 500);
  }
});
