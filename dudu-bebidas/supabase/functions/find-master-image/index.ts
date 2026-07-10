// ─────────────────────────────────────────────────────────────
// Edge Function: find-master-image
//
// Recebe o nome de um produto, normaliza para slug e procura uma
// imagem correspondente dentro do catálogo mestre do Cloudinary
// (Fdtech/master/bebidas/**), usando a Search API oficial.
//
// Busca em duas camadas (ver _shared/cloudinary.ts):
//   1) match exato do nome inteiro (rápido, cobre a maioria dos casos)
//   2) se não achar, busca por palavra-chave e escolhe o candidato com
//      mais sobreposição de palavras — tolera nome com detalhe a mais
//      ("Heineken Long Neck 330ml Garrafa") ou a menos ("Heineken") em
//      relação ao arquivo cadastrado no catálogo.
//
// Body esperado:
//   { "productName": "Heineken Long Neck" }
//
// Respostas:
//   { "found": true,  "url": "https://...", "matchType": "exact" | "fuzzy" }
//   { "found": false }
// ─────────────────────────────────────────────────────────────

import { getCloudinaryConfig, searchByFilenameFuzzy } from "../_shared/cloudinary.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-store-id",
};

const MASTER_FOLDER = "Fdtech/master/bebidas";

// Palavras que não ajudam a identificar QUAL produto é (tamanho, unidade,
// embalagem genérica) — excluídas só da busca ampla/ranqueamento da camada 2,
// pra não distrair o match por coisas que várias bebidas diferentes têm em
// comum (ex: "long-neck", "600ml" aparecem em dezenas de produtos).
const NOISE_WORDS = new Set([
  "ml", "l", "lt", "litro", "litros", "kg", "g", "un", "unid", "unidade",
  "cx", "caixa", "pct", "pacote", "garrafa", "lata", "long", "neck",
  "de", "com", "sem", "e", "o", "a", "um", "uma",
]);

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

// Tokens relevantes pra busca ampla: sem ruído, sem número isolado
// (tamanho/quantidade), sem token de 1 letra.
function extractKeywordTokens(slug: string): string[] {
  return slug
    .split("-")
    .filter(Boolean)
    .filter((token) => !NOISE_WORDS.has(token))
    .filter((token) => !/^\d+([.,]\d+)?$/.test(token)) // número isolado (275, 1.5)
    .filter((token) => token.length >= 2);
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
    const keywordTokens = extractKeywordTokens(slug);
    const result = await searchByFilenameFuzzy(config, MASTER_FOLDER, slug, keywordTokens);

    if (result) {
      return new Response(
        JSON.stringify({ found: true, url: result.secure_url, matchType: result.matchType }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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