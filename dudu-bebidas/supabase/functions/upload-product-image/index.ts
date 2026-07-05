// ─────────────────────────────────────────────────────────────
// Edge Function: upload-product-image
//
// Recebe uma imagem em base64 e faz upload AUTENTICADO (assinado)
// para o Cloudinary, dentro de Fdtech/stores/{storeId}/products/.
// Nunca usa Upload Preset Unsigned — a assinatura é gerada aqui,
// no servidor, com o API_SECRET que nunca é exposto ao frontend.
//
// Body esperado:
//   {
//     "storeId": "dudu-bebidas",
//     "fileBase64": "data:image/png;base64,...."
//   }
//
// Resposta:
//   { "url": "https://res.cloudinary.com/..." }
// ─────────────────────────────────────────────────────────────

import {
  getCloudinaryConfig,
  uploadSignedImage,
} from "../_shared/cloudinary.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_BASE64_LENGTH = 8_000_000; // ~6MB de imagem, margem de segurança

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { storeId, fileBase64 } = await req.json();

    if (!storeId || typeof storeId !== "string") {
      return new Response(JSON.stringify({ error: "storeId é obrigatório." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (
      !fileBase64 ||
      typeof fileBase64 !== "string" ||
      !fileBase64.startsWith("data:image/")
    ) {
      return new Response(JSON.stringify({ error: "Imagem inválida." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (fileBase64.length > MAX_BASE64_LENGTH) {
      return new Response(
        JSON.stringify({
          error: "Imagem muito grande. Envie um arquivo menor.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const safeStoreId = storeId.replace(/[^a-zA-Z0-9_-]/g, "");
    const folder = `Fdtech/stores/${safeStoreId}/products`;

    const config = getCloudinaryConfig();
    const { secure_url } = await uploadSignedImage(config, fileBase64, folder);

    return new Response(JSON.stringify({ url: secure_url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erro em upload-product-image:", err);
    return new Response(
      JSON.stringify({ error: "Erro ao fazer upload da imagem." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
