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
 * Executa uma busca crua na Search API do Cloudinary e devolve os recursos
 * encontrados (public_id + url), sem nenhuma lógica de "qual é o melhor".
 */
async function searchResources(
  config: CloudinaryConfig,
  expression: string,
  maxResults: number,
): Promise<Array<{ public_id: string; secure_url: string }>> {
  const auth = btoa(`${config.apiKey}:${config.apiSecret}`);
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/resources/search`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expression, max_results: maxResults }),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Cloudinary Search API falhou: ${response.status} ${errText}`,
    );
  }

  const data = await response.json();
  return (data?.resources ?? []).map((r: { public_id: string; secure_url: string }) => ({
    public_id: r.public_id,
    secure_url: r.secure_url,
  }));
}

/**
 * Busca EXATA de verdade: usa o operador "=" do Cloudinary, que exige que
 * o valor do campo seja idêntico ao buscado — diferente de ":" (usado antes),
 * que na prática casa por QUALQUER palavra dentro do nome (ex: buscar
 * "kaiser-600ml" com ":" também "acha" "caixa-kaiser-600ml", porque os dois
 * contêm os tokens "kaiser" e "600ml"). Mantida por compatibilidade e por
 * ser o caminho mais rápido quando existe um arquivo com nome idêntico.
 */
export async function searchByFilename(
  config: CloudinaryConfig,
  folderPrefix: string,
  filenameSlug: string,
): Promise<{ secure_url: string } | null> {
  const results = await searchResources(
    config,
    `folder:${folderPrefix}/* AND filename=${filenameSlug}`,
    1,
  );
  return results[0] ?? null;
}

/**
 * Compara duas listas de tokens (palavras de um slug) e retorna um score de
 * 0 a 1 (coeficiente de Dice) — 1 = todas as palavras batem, 0 = nenhuma.
 * Tokens são considerados iguais também quando um é prefixo do outro com
 * pelo menos 4 letras (cobre plural/singular e pequenas variações, ex:
 * "cabare" ~ "cabares", "heineken" ~ "heinek"), e ignora ponto solto (ex:
 * "1.5l" ~ "15l" — o normalizeSlug do nome digitado remove o ponto, mas
 * alguns arquivos do catálogo foram salvos com ele).
 */
function normalizeToken(t: string): string {
  return t.replace(/\./g, "");
}

function tokensMatch(a: string, b: string): boolean {
  const na = normalizeToken(a);
  const nb = normalizeToken(b);
  if (na === nb) return true;
  if (na.length >= 4 && nb.length >= 4 && (na.startsWith(nb) || nb.startsWith(na))) {
    return true;
  }
  return false;
}

function diceScore(queryTokens: string[], candidateTokens: string[]): number {
  const usedCandidate = new Set<number>();
  let intersection = 0;

  for (const qt of queryTokens) {
    for (let i = 0; i < candidateTokens.length; i++) {
      if (usedCandidate.has(i)) continue;
      if (tokensMatch(qt, candidateTokens[i])) {
        intersection++;
        usedCandidate.add(i);
        break;
      }
    }
  }

  const denom = queryTokens.length + candidateTokens.length;
  return denom === 0 ? 0 : (2 * intersection) / denom;
}

const MIN_FUZZY_SCORE = 0.5;
const MAX_FUZZY_CANDIDATES = 30;

/**
 * Busca em duas camadas:
 *   1) Tenta o match exato do slug inteiro (rápido, 1 chamada).
 *   2) Se não achar, busca candidatos por QUALQUER palavra-chave relevante
 *      do produto (folder:* AND (filename:palavra1 OR filename:palavra2 ...))
 *      e escolhe, entre os candidatos, o que tem maior sobreposição de
 *      palavras com o nome buscado — assim tolera nome com palavra a mais
 *      ("ICE CABARE LIMÃO PROMOCIONAL") ou a menos ("ICE CABARE") em relação
 *      ao arquivo cadastrado no catálogo ("ice-cabare-limao-275ml").
 *
 * REGRA DE OURO (evita trocar de marca): a primeira palavra-chave do nome
 * digitado — normalmente a marca ("amstel", "stella", "guarana"...) —
 * PRECISA aparecer no candidato. Sem essa trava, "AMSTEL 473ml PACK" podia
 * casar com um arquivo "budweiser-473ml-pack" só porque "473ml" e "pack"
 * batiam — palavras genéricas de embalagem não podem, sozinhas, decidir o
 * produto. Foi assim que achamos imagem de marca errada em vários produtos.
 *
 * @param keywordTokens tokens já filtrados (sem tamanho, unidade, número
 *   isolado, "lata"/"garrafa" etc. — mas "pack" fica de propósito, pra ainda
 *   dar pra diferenciar "amstel-473ml" de "amstel-473ml-pack") usados na
 *   busca ampla da camada 2
 *   E no ranqueamento — o primeiro token da lista é tratado como a "marca"
 *   pra regra acima. Se vazio, pula direto para "não encontrado".
 * @param noiseWords mesmo conjunto de palavras genéricas usado pra montar
 *   keywordTokens — aplicado aqui também aos tokens do CANDIDATO, pra não
 *   comparar de forma desigual (só filtrar um lado inflava o denominador
 *   do Dice contra candidatos legítimos que também têm essas palavras).
 */
export async function searchByFilenameFuzzy(
  config: CloudinaryConfig,
  folderPrefix: string,
  fullSlug: string,
  keywordTokens: string[],
  noiseWords: Set<string>,
): Promise<{ secure_url: string; matchType: "exact" | "fuzzy"; score?: number } | null> {
  // Camada 1: match exato/tokenizado do slug inteiro
  const exact = await searchByFilename(config, folderPrefix, fullSlug);
  if (exact) {
    return { secure_url: exact.secure_url, matchType: "exact" };
  }

  if (keywordTokens.length === 0) return null;

  // Camada 2: busca ampla por qualquer palavra-chave, depois ranqueia localmente
  const orExpression = keywordTokens.map((t) => `filename:${t}`).join(" OR ");
  const candidates = await searchResources(
    config,
    `folder:${folderPrefix}/* AND (${orExpression})`,
    MAX_FUZZY_CANDIDATES,
  );

  if (candidates.length === 0) return null;

  const brandToken = keywordTokens[0];

  let best: { public_id: string; secure_url: string } | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const filename = candidate.public_id.split("/").pop() ?? "";
    const candidateTokens = filename
      .split("-")
      .filter(Boolean)
      .filter((t) => !noiseWords.has(t));

    // Regra de ouro: sem a "marca" no candidato, nem entra na disputa.
    const brandPresent = candidateTokens.some((ct) => tokensMatch(brandToken, ct));
    if (!brandPresent) continue;

    const score = diceScore(keywordTokens, candidateTokens);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  if (best && bestScore >= MIN_FUZZY_SCORE) {
    return { secure_url: best.secure_url, matchType: "fuzzy", score: bestScore };
  }

  return null;
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
  publicId?: string,
): Promise<{ secure_url: string }> {
  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign: Record<string, string | number> = { folder, timestamp };

  // Quando temos o id do produto, fixamos o public_id e pedimos overwrite —
  // sem isso, toda troca de imagem criava um arquivo novo com nome aleatório
  // no Cloudinary, deixando o antigo órfão pra sempre (era a causa da
  // duplicação de imagens que encontramos). "invalidate" garante que o CDN
  // não sirva a imagem antiga em cache depois da troca.
  if (publicId) {
    paramsToSign.public_id = publicId;
    paramsToSign.overwrite = "true";
    paramsToSign.invalidate = "true";
  }

  const signature = await signParams(paramsToSign, config.apiSecret);

  const form = new FormData();
  form.append("file", base64File);
  form.append("api_key", config.apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  if (publicId) {
    form.append("public_id", publicId);
    form.append("overwrite", "true");
    form.append("invalidate", "true");
  }
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