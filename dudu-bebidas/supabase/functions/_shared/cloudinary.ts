// ─────────────────────────────────────────────────────────────
// Helper compartilhado: autenticação e chamadas à Admin API do
// Cloudinary. Usado por find-master-image e upload-product-image.
//
// Nunca expõe API_SECRET ao frontend — tudo roda só aqui, no servidor.
// ─────────────────────────────────────────────────────────────

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export function getCloudinaryConfig(): CloudinaryConfig {
  const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME") ?? "";
  const apiKey = Deno.env.get("CLOUDINARY_API_KEY") ?? "";
  const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET") ?? "";

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Configuração do Cloudinary ausente. Defina CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET como secrets do Supabase.",
    );
  }

  return { cloudName, apiKey, apiSecret };
}

// Gera a assinatura SHA-1 exigida pela API autenticada do Cloudinary
// (uploads assinados — nunca usamos "Upload Preset Unsigned").
async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signParams(
  params: Record<string, string | number>,
  apiSecret: string,
): Promise<string> {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return sha1Hex(`${sorted}${apiSecret}`);
}

/**
 * Busca imagens no Cloudinary usando a Search API oficial, percorrendo
 * recursivamente todas as subpastas de um prefixo de pasta.
 * Mecanismo oficial recomendado pelo Cloudinary para buscas por nome
 * em múltiplas pastas (evita listagens manuais improvisadas).
 */
export async function searchByFilename(
  config: CloudinaryConfig,
  folderPrefix: string,
  filenameSlug: string,
): Promise<{ secure_url: string } | null> {
  const expression = `folder:${folderPrefix}/* AND filename:${filenameSlug}`;

  const auth = btoa(`${config.apiKey}:${config.apiSecret}`);
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/resources/search`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expression,
        max_results: 1,
      }),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Cloudinary Search API falhou: ${response.status} ${errText}`,
    );
  }

  const data = await response.json();
  const resource = data?.resources?.[0];
  return resource ? { secure_url: resource.secure_url } : null;
}

/**
 * Faz upload autenticado (assinado) de uma imagem em base64 para uma
 * pasta específica do Cloudinary. A pasta é criada automaticamente
 * pelo próprio Cloudinary caso não exista.
 */
export async function uploadSignedImage(
  config: CloudinaryConfig,
  base64File: string,
  folder: string,
): Promise<{ secure_url: string }> {
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = { folder, timestamp };
  const signature = await signParams(paramsToSign, config.apiSecret);

  const form = new FormData();
  form.append("file", base64File);
  form.append("api_key", config.apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
    {
      method: "POST",
      body: form,
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Upload para Cloudinary falhou: ${response.status} ${errText}`,
    );
  }

  const data = await response.json();
  return { secure_url: data.secure_url };
}
