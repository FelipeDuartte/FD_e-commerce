// ─────────────────────────────────────────────────────────────
// Helper compartilhado: autenticação e busca no catálogo mestre do
// Cloudinary. Usado por find-master-image.
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

const CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;
const CATALOG_PAGE_SIZE = 500;
const CATALOG_MAX_PAGES = 20;

type CatalogEntry = { public_id: string; secure_url: string };

const catalogCache = new Map<string, { at: number; items: CatalogEntry[] }>();

// Lista o catálogo mestre inteiro (paginado) e guarda em memória por alguns
// minutos — o ranqueamento é feito aqui no servidor, não pela Search API,
// porque ela só casa palavra inteira ("para tudo" nunca achava "paratudo").
async function listCatalog(config: CloudinaryConfig, folderPrefix: string): Promise<CatalogEntry[]> {
  const cached = catalogCache.get(folderPrefix);
  if (cached && Date.now() - cached.at < CATALOG_CACHE_TTL_MS) return cached.items;

  const auth = btoa(`${config.apiKey}:${config.apiSecret}`);
  const items: CatalogEntry[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < CATALOG_MAX_PAGES; page++) {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${config.cloudName}/resources/search`,
      {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          expression: `folder:${folderPrefix}/*`,
          max_results: CATALOG_PAGE_SIZE,
          ...(cursor ? { next_cursor: cursor } : {}),
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`Cloudinary Search API falhou: ${response.status} ${await response.text()}`);
    }
    const data = await response.json();
    for (const r of data?.resources ?? []) {
      items.push({ public_id: r.public_id, secure_url: r.secure_url });
    }
    cursor = data?.next_cursor;
    if (!cursor) break;
  }

  catalogCache.set(folderPrefix, { at: Date.now(), items });
  return items;
}

function normalizeToken(t: string): string {
  return t.replace(/\./g, "");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = curr;
  }
  return prev[b.length];
}

// Iguais, um prefixo do outro (plural, "heinek"), ou 1–2 letras trocadas
// (erro de digitação: "heiniken" ~ "heineken"). Números nunca entram no
// "erro de digitação" — 300ml e 600ml são produtos diferentes.
function tokensMatch(a: string, b: string): boolean {
  const na = normalizeToken(a);
  const nb = normalizeToken(b);
  if (na === nb) return true;
  if (na.length >= 4 && nb.length >= 4 && (na.startsWith(nb) || nb.startsWith(na))) return true;
  if (/\d/.test(na) || /\d/.test(nb)) return false;
  const shorter = Math.min(na.length, nb.length);
  if (shorter >= 5 && levenshtein(na, nb) <= (shorter >= 8 ? 2 : 1)) return true;
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

function trigrams(s: string): string[] {
  const padded = ` ${s} `;
  const out: string[] = [];
  for (let i = 0; i < padded.length - 2; i++) out.push(padded.slice(i, i + 3));
  return out;
}

// Compara as letras ignorando onde estão os espaços — é o que faz
// "para tudo" e "paratudo" serem a mesma coisa.
function trigramDice(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const t of tb) counts.set(t, (counts.get(t) ?? 0) + 1);
  let shared = 0;
  for (const t of ta) {
    const c = counts.get(t) ?? 0;
    if (c > 0) {
      shared++;
      counts.set(t, c - 1);
    }
  }
  return (2 * shared) / (ta.length + tb.length);
}

const compact = (s: string) => s.replace(/[-.]/g, "");

const MIN_FUZZY_SCORE = 0.5;

// Tipo de bebida não é marca — "VODKA KRISKOF RED" tem marca "kriskof", e o
// arquivo do catálogo normalmente nem tem "vodka" no nome. Continuam
// contando no score, só não podem ser a palavra obrigatória da regra de ouro.
const CATEGORY_WORDS = new Set([
  "vodka", "whisky", "whiskey", "gin", "rum", "tequila", "cachaca", "pinga", "licor", "vinho",
  "espumante", "champagne", "cerveja", "chopp", "chope", "refrigerante", "refri", "suco", "energetico",
  "agua", "isotonico", "drink", "aperitivo", "conhaque", "saque", "sake", "batida", "coquetel",
]);

export interface CatalogMatch {
  secure_url: string;
  filename: string;
  matchType: "exact" | "fuzzy";
  score: number;
}

/**
 * Ranqueia o catálogo inteiro contra o nome digitado e devolve os melhores.
 *
 * "exact" = mesmas letras ignorando espaço/hífen/ponto ("para tudo 900ml"
 * = "paratudo-900ml"). Fora isso, o score é o maior entre a sobreposição de
 * palavras (tolerante a erro de digitação) e a semelhança de letras.
 *
 * REGRA DE OURO (evita trocar de marca): a primeira palavra-chave do nome
 * digitado que não é tipo de bebida — normalmente a marca — PRECISA
 * aparecer no candidato. Sem essa
 * trava, "AMSTEL 473ml PACK" casava com "budweiser-473ml-pack" só porque
 * "473ml" e "pack" batiam.
 *
 * @param keywordTokens tokens do nome sem tamanho genérico/embalagem/número
 *   solto; o primeiro é tratado como a "marca".
 * @param noiseWords mesmas palavras genéricas, aplicadas também ao candidato
 *   pra comparar os dois lados de forma igual.
 */
export async function findCatalogMatches(
  config: CloudinaryConfig,
  folderPrefix: string,
  fullSlug: string,
  keywordTokens: string[],
  noiseWords: Set<string>,
  limit = 3,
): Promise<CatalogMatch[]> {
  const catalog = await listCatalog(config, folderPrefix);
  const queryCompact = compact(fullSlug);
  const queryKeywordCompact = compact(keywordTokens.join(""));
  const brandToken =
    keywordTokens.find((t) => !CATEGORY_WORDS.has(t) && !/^\d/.test(t)) ?? keywordTokens[0];
  const scored: Array<CatalogMatch & { tiebreak: number }> = [];
  for (const entry of catalog) {
    const filename = entry.public_id.split("/").pop() ?? "";
    if (compact(filename) === queryCompact) {
      scored.push({ secure_url: entry.secure_url, filename, matchType: "exact", score: 1, tiebreak: 1 });
      continue;
    }
    if (!brandToken) continue;

    const candidateTokens = filename.split("-").filter(Boolean).filter((t) => !noiseWords.has(t));
    const candidateCompact = compact(candidateTokens.join(""));

    const brandPresent =
      candidateTokens.some((ct) => tokensMatch(brandToken, ct)) ||
      (brandToken.length >= 4 && candidateCompact.includes(normalizeToken(brandToken)));
    if (!brandPresent) continue;

    const score = Math.max(
      diceScore(keywordTokens, candidateTokens),
      trigramDice(queryKeywordCompact, candidateCompact),
    );
    if (score >= MIN_FUZZY_SCORE) {
      // Desempate pelo nome inteiro (inclui tamanho, "long neck" etc. que
      // ficaram de fora do score principal).
      const tiebreak = trigramDice(queryCompact, compact(filename));
      scored.push({ secure_url: entry.secure_url, filename, matchType: "fuzzy", score, tiebreak });
    }
  }

  const rank = (m: CatalogMatch) => (m.matchType === "exact" ? 1 : 0);
  return scored
    .sort((a, b) => rank(b) - rank(a) || b.score - a.score || b.tiebreak - a.tiebreak)
    .slice(0, limit)
    .map(({ tiebreak: _tiebreak, ...m }) => m);
}
