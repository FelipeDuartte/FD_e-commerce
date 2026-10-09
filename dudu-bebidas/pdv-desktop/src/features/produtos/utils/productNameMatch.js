// Comparação de nomes de produto tolerante a espaço ("para tudo" ~
// "paratudo"), acento, maiúscula e erro de digitação ("heiniken" ~
// "heineken"). Mesma ideia do ranqueamento da edge function
// find-master-image (supabase/functions/_shared/cloudinary.ts) — replicada
// porque Edge Functions rodam em Deno e não compartilham bundle com o Vite.

export function normalizeSlug(text) {
  if (!text) return "";
  return String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/,/g, ".")
    .replace(/[^a-z0-9\s.-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const compact = (slug) => slug.replace(/[-.]/g, "");

function levenshtein(a, b) {
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

function tokensMatch(a, b) {
  const na = a.replace(/\./g, "");
  const nb = b.replace(/\./g, "");
  if (na === nb) return true;
  if (na.length >= 4 && nb.length >= 4 && (na.startsWith(nb) || nb.startsWith(na))) return true;
  if (/\d/.test(na) || /\d/.test(nb)) return false;
  const shorter = Math.min(na.length, nb.length);
  return shorter >= 5 && levenshtein(na, nb) <= (shorter >= 8 ? 2 : 1);
}

function diceScore(aTokens, bTokens) {
  const used = new Set();
  let intersection = 0;
  for (const a of aTokens) {
    const idx = bTokens.findIndex((b, i) => !used.has(i) && tokensMatch(a, b));
    if (idx >= 0) {
      used.add(idx);
      intersection++;
    }
  }
  const denom = aTokens.length + bTokens.length;
  return denom === 0 ? 0 : (2 * intersection) / denom;
}

function trigrams(s) {
  const padded = ` ${s} `;
  const out = [];
  for (let i = 0; i < padded.length - 2; i++) out.push(padded.slice(i, i + 3));
  return out;
}

function trigramDice(a, b) {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (!ta.length || !tb.length) return 0;
  const counts = new Map();
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

// Embalagem, tipo de bebida e conectivos não dizem QUAL produto é — "Caixa
// Brahma" e "Caixa Skol", ou "Vodka Smirnoff" e "Vodka Absolut", não podem
// parecer o mesmo produto só por causa do "caixa"/"vodka".
const GENERIC_WORDS = new Set([
  "caixa", "cx", "pack", "fardo", "lata", "garrafa", "long", "neck", "litro", "litrinho",
  "un", "unid", "unidade", "de", "da", "do", "com", "sem", "e", "o", "a",
  "vodka", "whisky", "whiskey", "gin", "rum", "tequila", "cachaca", "pinga", "licor", "vinho",
  "espumante", "champagne", "cerveja", "chopp", "chope", "refrigerante", "refri", "suco", "energetico",
  "agua", "isotonico", "drink", "aperitivo", "conhaque", "saque", "sake", "batida", "coquetel",
]);

function brandOf(tokens) {
  return tokens.find((t) => !GENERIC_WORDS.has(t) && !/^\d/.test(t)) ?? tokens.find((t) => !/^\d/.test(t)) ?? null;
}

const numbersOf = (slug) => (slug.match(/\d+(\.\d+)?/g) ?? []).sort().join("|");

function analyze(name) {
  const slug = normalizeSlug(normalizeProductName(name));
  const tokens = slug.split("-").filter(Boolean);
  return { slug, tokens, compact: compact(slug), brand: brandOf(tokens), numbers: numbersOf(slug) };
}

// Mesmo produto escrito diferente: mesmas letras ignorando espaço/acento,
// ou 1–2 letras de diferença com os MESMOS números (300ml ≠ 600ml).
function isNearDuplicate(a, b) {
  if (!a.compact || !b.compact) return false;
  if (a.compact === b.compact) return true;
  if (a.numbers !== b.numbers) return false;
  const shorter = Math.min(a.compact.length, b.compact.length);
  return shorter >= 5 && levenshtein(a.compact, b.compact) <= (shorter >= 10 ? 2 : 1);
}

function similarity(a, b) {
  if (a.compact === b.compact) return 1;
  if (!a.brand) return 0;
  const brandPresent =
    b.tokens.some((t) => tokensMatch(a.brand, t)) || (a.brand.length >= 4 && b.compact.includes(a.brand));
  if (!brandPresent) return 0;
  return Math.max(diceScore(a.tokens, b.tokens), trigramDice(a.compact, b.compact));
}

const SIMILAR_MIN_SCORE = 0.7;

/**
 * Produtos já cadastrados parecidos com o nome (ou mesmo EAN) digitado.
 * Retorna até `limit`, mais parecidos primeiro, cada um com
 * `nearDuplicate: true` quando é praticamente o mesmo produto.
 */
export function findSimilarProducts(name, ean, products, { excludeId, limit = 3 } = {}) {
  const query = analyze(name);
  const trimmedEan = String(ean ?? "").trim();
  if (query.compact.length < 3 && !trimmedEan) return [];

  const results = [];
  for (const p of products) {
    if (p.id === excludeId) continue;
    const sameEan = Boolean(trimmedEan) && String(p.ean ?? "").trim() === trimmedEan;
    const other = analyze(p.name);
    const nearDuplicate = sameEan || (query.compact.length >= 3 && isNearDuplicate(query, other));
    const score = nearDuplicate ? 1 : query.compact.length >= 3 ? similarity(query, other) : 0;
    if (score >= SIMILAR_MIN_SCORE) results.push({ product: p, score, nearDuplicate, sameEan });
  }
  return results.sort((x, y) => y.score - x.score).slice(0, limit);
}

// Ignora só maiúscula/acento/unidade — "para tudo" ≠ "Paratudo" aqui de
// propósito, pra sugerir a escrita do catálogo.
export function isSameNameIgnoringCase(a, b) {
  return normalizeSlug(normalizeProductName(a)) === normalizeSlug(normalizeProductName(b));
}

const UNIT_ALIASES = { ml: "ml", l: "L", lt: "L", lts: "L", litro: "L", litros: "L", kg: "kg", g: "g" };

/**
 * Limpeza aplicada ao salvar: espaços duplicados, número colado na unidade
 * e unidade padronizada ("600 ML" → "600ml", "1,5 litros" → "1.5L").
 * Não mexe em maiúsculas/minúsculas do resto do nome — e se o nome
 * inteiro está em maiúsculas, a unidade também fica ("SKOL 600ML").
 */
export function normalizeProductName(name) {
  const cleaned = String(name ?? "").replace(/\s+/g, " ").trim();
  const allCaps = /[A-Z]/.test(cleaned) && !/[a-zà-ú]/.test(cleaned);
  return cleaned.replace(/(\d+(?:[.,]\d+)?)\s*(ml|lts|lt|litros|litro|l|kg|g)(?![a-zà-ú])/gi, (_, num, unit) => {
    const u = UNIT_ALIASES[unit.toLowerCase()];
    return `${num.replace(",", ".")}${allCaps ? u.toUpperCase() : u}`;
  });
}

/**
 * Nome "bonito" a partir do nome do arquivo do catálogo
 * ("paratudo-900ml" → "Paratudo 900ml"), no padrão da dica de nomes.
 */
const LOWERCASE_WORDS = new Set(["lata", "garrafa", "litro", "litrinho", "de", "da", "do", "com", "sem", "e"]);

export function catalogFilenameToName(filename) {
  return String(filename ?? "")
    .split("-")
    .filter(Boolean)
    .map((t, i) => {
      if (/^\d/.test(t)) return normalizeProductName(t);
      if (i > 0 && LOWERCASE_WORDS.has(t)) return t;
      return t.charAt(0).toUpperCase() + t.slice(1);
    })
    .join(" ");
}
