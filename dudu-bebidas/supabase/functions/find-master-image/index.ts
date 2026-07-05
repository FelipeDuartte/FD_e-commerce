// ─────────────────────────────────────────────────────────────
// Edge Function: find-master-image
//
// Recebe o nome de um produto, normaliza para slug e procura uma
// imagem correspondente dentro do catálogo mestre do Cloudinary
// (Fdtech/master/bebidas/**), usando a Search API oficial.
//
// Body esperado:
//   { "productName": "Heineken Long Neck" }
//
// Respostas:
//   { "found": true,  "url": "https://..." }
//   { "found": false }
// ─────────────────────────────────────────────────────────────

import { getCloudinaryConfig, searchByFilename } from "../_shared/cloudinary.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MASTER_FOLDER = "Fdtech/master/bebidas";

// Mesma lógica de src/utils/normalizeSlug.js, replicada aqui porque
// Edge Functions rodam em Deno e não compartilham bundle com o Vite.
function normalizeSlug(text: string): string {
  if (!text) return "";
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { productName } = await req.json();

    if (!productName || typeof productName !== "string") {
      return new Response(JSON.stringify({ error: "productName é obrigatório." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const slug = normalizeSlug(productName);

    if (!slug) {
      return new Response(JSON.stringify({ found: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = getCloudinaryConfig();
    const result = await searchByFilename(config, MASTER_FOLDER, slug);

    if (result) {
      return new Response(JSON.stringify({ found: true, url: result.secure_url }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ found: false }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erro em find-master-image:", err);
    return new Response(JSON.stringify({ error: "Erro ao buscar imagem no catálogo." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});