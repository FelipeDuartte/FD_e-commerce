// ─────────────────────────────────────────────────────────────
// Lógica do chatbot de atendimento (plano básico: menu, sem IA).
//
// Recebe a mensagem do cliente já resumida (texto ou opção escolhida) e
// devolve UMA resposta — sempre uma só, pra gastar o mínimo de mensagens.
// Não usa nenhuma API do Deno nem acessa o banco direto: os dados chegam
// por um "loader" (BotData), então dá pra testar sob Vitest com dados de
// mentira (ver bot.test.ts).
// ─────────────────────────────────────────────────────────────

export interface StoreInfo {
  name: string;
  whatsapp: string | null; // atendimento humano (stores.whatsapp)
  pickupAddress: string | null;
  pickupAddressDetail: string | null;
  siteUrl: string | null;
}

export interface StoreHour {
  day_of_week: number; // 0 = domingo
  is_open: boolean;
  open_time: string | null; // "09:00:00"
  close_time: string | null;
}

export interface StoreConfig {
  close_on_holidays: boolean | null;
  free_shipping_threshold: number | null;
  payment_methods_enabled: Record<string, boolean> | null;
  online_payment?: boolean; // loja com pagamento online (InfinitePay) configurado
}

export interface DeliveryZone {
  nome: string;
  frete: number;
  is_retirada: boolean;
}

export interface BotProduct {
  name: string;
  price: number;
  old_price: number | null;
  promotion: boolean | null;
  stock: number;
  category?: string | null; // "cerveja", "refrigerante"... (busca "tem cerveja?")
}

export interface RecentOrder {
  order_number: number;
  status: string;
  total: number;
  created_at: string;
  address: { phone?: string; isRetirada?: boolean } | null;
}

// Dados da loja carregados sob demanda — cada resposta só busca o que usa.
export interface BotData {
  store: StoreInfo;
  hours(): Promise<StoreHour[]>;
  config(): Promise<StoreConfig | null>;
  zones(): Promise<DeliveryZone[]>;
  products(): Promise<BotProduct[]>;
  recentOrders(): Promise<RecentOrder[]>;
}

export type BotInput =
  | { kind: "text"; text: string }
  | { kind: "choice"; id: string }
  | { kind: "other"; media?: string }; // áudio, foto, figurinha, localização...

export interface MenuRow {
  id: string;
  title: string; // até 24 caracteres (limite da Meta)
  description?: string; // até 72
}

export type BotReply =
  | { type: "text"; body: string }
  | { type: "buttons"; body: string } // texto + botão "Ver menu"
  | { type: "list"; body: string; button: string; rows: MenuRow[] };

// Limites da Meta para mensagens interativas
const INTERACTIVE_BODY_MAX = 1024;
const MAX_ZONES_LISTED = 30;
const MAX_PRODUCTS_LISTED = 6;
const TEXT_BODY_MAX = 4096;

export const TIME_ZONE = "America/Sao_Paulo";
const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

// ── Texto ───────────────────────────────────────────────────

/** Minúsculas, sem acento, só letras/números separados por espaço. */
export function normalizeText(text: string): string {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function formatBRL(value: number): string {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function waLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`;
}

// ── Horário de Brasília ─────────────────────────────────────

interface LocalTime {
  year: number;
  month: number;
  day: number;
  weekday: number;
  minutes: number; // minutos desde 00:00
}

/** Data/hora em Brasília — o servidor roda em UTC. */
export function localTime(now: Date): LocalTime {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

// Feriados nacionais — mesma regra do site (src/shared/utils/holidays.js)
function easter(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  return { month: Math.floor((h + l - 7 * m + 114) / 31), day: ((h + l - 7 * m + 114) % 31) + 1 };
}

export function isHoliday(t: LocalTime): boolean {
  const key = (month: number, day: number) => `${month}-${day}`;
  const fixed = ["1-1", "4-21", "5-1", "9-7", "10-12", "11-2", "11-15", "11-20", "12-25"];
  const e = easter(t.year);
  const easterUtc = Date.UTC(t.year, e.month - 1, e.day);
  const movable = [-47, -2, 0, 60].map((offset) => {
    const d = new Date(easterUtc + offset * 86_400_000);
    return key(d.getUTCMonth() + 1, d.getUTCDate());
  });
  return [...fixed, ...movable].includes(key(t.month, t.day));
}

const hhmm = (time: string | null, fallback: string) => (time ?? fallback).slice(0, 5);
const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

/** "Aberto agora" — mesma regra do site (src/shared/utils/storeChecker.js). */
export function openNowMessage(hours: StoreHour[], config: StoreConfig | null, now: Date): string {
  const t = localTime(now);
  if (config?.close_on_holidays && isHoliday(t)) return "🔴 Hoje é feriado: estamos *fechados*.";
  const today = hours.find((h) => h.day_of_week === t.weekday);
  if (!today) return "🟢 Estamos *abertos* agora.";
  if (!today.is_open) return "🔴 Hoje estamos *fechados*.";
  const open = hhmm(today.open_time, "09:00");
  const close = hhmm(today.close_time, "19:00");
  if (t.minutes < toMinutes(open)) return `🔴 Ainda não abrimos. Hoje abrimos às *${open}*.`;
  if (t.minutes >= toMinutes(close)) return `🔴 Já fechamos por hoje (fechamos às ${close}).`;
  return `🟢 Estamos *abertos* agora, até as *${close}*.`;
}

/** Dia da semana citado na mensagem ("abre domingo?", "amanhã") ou feriado. */
function askedDay(tokens: string[], now: Date): number | "feriado" | null {
  const names = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
  for (const t of tokens) {
    const day = names.indexOf(t);
    if (day >= 0) return day;
    if (t === "amanha") return (localTime(now).weekday + 1) % 7;
    if (t === "feriado" || t === "feriados") return "feriado";
  }
  return null;
}

function dayLine(hours: StoreHour[], config: StoreConfig | null, day: number | "feriado"): string | null {
  if (day === "feriado") {
    return config?.close_on_holidays ? "📅 Em feriados: *fechado*." : "📅 Em feriados abrimos normalmente.";
  }
  const h = hours.find((x) => x.day_of_week === day);
  if (!h) return null;
  return h.is_open
    ? `📅 *${WEEKDAYS[day]}*: ${hhmm(h.open_time, "09:00")} às ${hhmm(h.close_time, "19:00")}`
    : `📅 *${WEEKDAYS[day]}*: fechado`;
}

function hoursReply(hours: StoreHour[], config: StoreConfig | null, now: Date, tokens: string[] = []): string {
  const week = WEEKDAYS.map((label, day) => {
    const h = hours.find((x) => x.day_of_week === day);
    if (!h) return null;
    return h.is_open
      ? `${label}: ${hhmm(h.open_time, "09:00")} às ${hhmm(h.close_time, "19:00")}`
      : `${label}: fechado`;
  }).filter(Boolean);
  const lines = ["🕐 *Horário de funcionamento*", "", openNowMessage(hours, config, now)];
  const day = askedDay(tokens, now);
  const focus = day === null ? null : dayLine(hours, config, day);
  if (focus) lines.push(focus);
  if (week.length) lines.push("", ...week);
  if (config?.close_on_holidays && day !== "feriado") lines.push("", "Feriados: fechado.");
  return lines.join("\n");
}

// ── Entrega e pagamento ─────────────────────────────────────

// Palavras depois de "no/na/em/pra" que não são nome de bairro
const NOT_A_PLACE = new Set([
  "casa", "minha", "meu", "aqui", "ai", "la", "hoje", "amanha", "agora", "domingo", "segunda", "terca",
  "quarta", "quinta", "sexta", "sabado", "feriado", "rua", "predio", "apartamento", "ap", "apto", "trabalho",
  "empresa", "loja", "quanto", "quantos", "tempo", "minutos", "horas", "que", "qual", "quando", "todo",
  "toda", "todos", "todas", "regiao", "bairro", "cidade", "mesmo", "dia", "noite", "tarde", "final", "fim",
  "semana", "pix", "cartao", "dinheiro", "entrega", "frete", "taxa", "voces", "nao", "sim", "meu", "seu",
  "o", "a", "os", "as", "um", "uma", "de", "da", "do", "e", "favor",
]);

/** Bairro citado na mensagem, comparando com os bairros cadastrados. */
function findZone(zones: DeliveryZone[], tokens: string[]): DeliveryZone | null {
  const text = ` ${tokens.join(" ")} `;
  for (const z of zones) {
    const name = normalizeText(z.nome);
    if (!name) continue;
    if (text.includes(` ${name} `)) return z;
    const words = name.split(" ").filter((w) => w.length >= 3);
    if (words.length && words.every((w) => tokens.some((t) => fuzzyEqual(t, w)))) return z;
  }
  return null;
}

/** "entregam no Jardim Europa?" → "jardim europa" (o que veio depois de no/na/em/pra). */
function placeMentioned(tokens: string[]): string | null {
  const i = tokens.findIndex((t) => ["no", "na", "em", "pro", "pra", "para", "ate"].includes(t));
  if (i < 0) return null;
  const words: string[] = [];
  for (const t of tokens.slice(i + 1)) {
    if (NOT_A_PLACE.has(t) || /^\d+$/.test(t) || isIntentWord(t)) break;
    words.push(t);
    if (words.length === 3) break;
  }
  return words.length ? words.join(" ") : null;
}

function deliveryReply(
  zones: DeliveryZone[],
  config: StoreConfig | null,
  tokens: string[] = [],
): string {
  const delivery = zones.filter((z) => !z.is_retirada);
  const pickup = zones.some((z) => z.is_retirada);
  if (!delivery.length && !pickup) {
    return "🛵 No momento não temos bairros de entrega cadastrados. Fale com o atendente para confirmar.";
  }
  const freeLine = config?.free_shipping_threshold
    ? `🎉 Frete grátis em compras acima de ${formatBRL(config.free_shipping_threshold)}.`
    : null;
  const fee = (z: DeliveryZone) => (Number(z.frete) > 0 ? formatBRL(z.frete) : "grátis");

  // Perguntou de um bairro específico
  const zone = findZone(delivery, tokens);
  if (zone) {
    const lines = [`🛵 Sim! Entregamos em *${zone.nome}*. Frete: *${fee(zone)}*.`];
    if (freeLine) lines.push("", freeLine);
    return lines.join("\n");
  }

  const place = placeMentioned(tokens);
  const lines = place
    ? [`🛵 Não encontrei *${place}* na nossa lista de bairros. Entregamos em:`, ""]
    : ["🛵 *Entrega e taxas*", ""];
  for (const z of delivery.slice(0, MAX_ZONES_LISTED)) lines.push(`• ${z.nome}: ${fee(z)}`);
  if (delivery.length > MAX_ZONES_LISTED) {
    lines.push(`… e mais ${delivery.length - MAX_ZONES_LISTED} bairro(s) — veja todos no site.`);
  }
  if (pickup) lines.push("", "🏪 Retirada na loja: grátis.");
  if (freeLine) lines.push("", freeLine);
  return lines.join("\n");
}

const ONLINE_PAYMENT_LABEL = "Pix ou cartão em até 12x (pelo site)";
const PAYMENT_LABELS: Record<string, string> = {
  pix_entrega: "Pix na entrega",
  cash: "Dinheiro na entrega",
  debit_card: "Cartão de débito na entrega",
  credit_card: "Cartão de crédito na entrega",
};

function paymentReply(config: StoreConfig | null): string {
  const enabled = config?.payment_methods_enabled ?? {};
  const labels = [
    ...(config?.online_payment && enabled.infinitepay !== false ? [ONLINE_PAYMENT_LABEL] : []),
    ...Object.keys(PAYMENT_LABELS).filter((k) => enabled[k]).map((k) => PAYMENT_LABELS[k]),
  ];
  if (!labels.length) return "💳 Fale com o atendente para saber as formas de pagamento.";
  return ["💳 *Formas de pagamento*", "", ...labels.map((l) => `• ${l}`)].join("\n");
}

// ── Texto do cliente → palavras ─────────────────────────────

// Abreviações comuns no WhatsApp
const ABBREVIATIONS: Record<string, string> = {
  hj: "hoje", hoj: "hoje", q: "que", oq: "o que", vc: "voces", vcs: "voces", voce: "voces", ce: "voces",
  cs: "voces", tb: "tambem", tbm: "tambem", tmb: "tambem", td: "tudo", pq: "porque", n: "nao",
  qto: "quanto", qnt: "quanto", qnto: "quanto", qtos: "quantos", msm: "mesmo", obg: "obrigado",
  obgd: "obrigado", obgda: "obrigada", brigado: "obrigado", brigada: "obrigada", vlw: "valeu",
  blz: "beleza", pfv: "favor", pf: "favor", pfvr: "favor", ent: "entao", dps: "depois",
  agr: "agora", aki: "aqui", hrs: "horas", hr: "horas", end: "endereco", zap: "whatsapp", wpp: "whatsapp",
  tao: "estao", to: "estou", fds: "fim de semana", sab: "sabado", dom: "domingo",
};

/** Normaliza, troca abreviações e junta volume ("2 litros" → "2l", "350 ml" → "350ml"). */
export function textTokens(text: string): string[] {
  const norm = normalizeText(text)
    .replace(/\b(\d+) ?(litros?|lts?|l)\b/g, "$1l")
    .replace(/\b(\d+) ?ml\b/g, "$1ml");
  return norm
    .split(" ")
    .filter(Boolean)
    .flatMap((t) => (ABBREVIATIONS[t] ?? t).split(" "));
}

/** Distância de edição (erros de digitação: "heinekem", "orario"). */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

const singular = (w: string) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w);

/** Mesma palavra, no plural ou com erro de digitação (palavras de 6+ letras). */
export function fuzzyEqual(token: string, word: string): boolean {
  if (token === word) return true;
  const a = singular(token);
  const b = singular(word);
  if (a === b) return true;
  if (a.length < 6 || b.length < 6) return false;
  // Palavras curtas do mesmo tamanho só com letra a mais/a menos:
  // "orario" ~ "horario", mas "carvao" ≠ "cartao"
  if (a.length === b.length && a.length < 7) return false;
  return editDistance(a, b) <= (a.length >= 9 ? 2 : 1);
}

// ── Produtos ────────────────────────────────────────────────

// Palavras que não identificam o produto ("tem heineken gelada?")
const SEARCH_NOISE = new Set([
  "tem", "teria", "voces", "ai", "o", "a", "os", "as", "de", "da", "do", "dos", "das", "um", "uma", "uns",
  "umas", "e", "ou", "com", "pra", "para", "por", "favor", "quero", "queria", "gostaria", "qual", "quais",
  "quanto", "quantos", "custa", "custando", "preco", "precos", "valor", "esta", "estao", "ta", "sai", "fica",
  "gelada", "gelado", "geladas", "gelados", "ainda", "hoje", "agora", "me", "manda", "mandar", "ver",
  "consultar", "produto", "produtos", "disponivel", "disponiveis", "estoque", "oi", "ola", "bom", "boa",
  "dia", "tarde", "noite", "saber", "sabe", "se", "existe", "ha", "tinha", "algum", "alguma", "alguns",
  "mais", "entao", "tudo", "bem", "que", "no", "na", "em", "aqui", "voce", "vende", "vendem", "vendendo",
  "trabalha", "trabalham", "tipo", "tipos", "marca", "marcas", "opcao", "opcoes", "sabor", "sabores",
  "unidade", "unidades", "un", "und", "caixa", "fardo", "pack", "barato", "barata", "baratas", "baratos",
  "boas", "bons", "melhor", "melhores", "tambem", "so", "isso", "esse", "essa", "nao", "sim", "eu", "ja",
  "como", "vai", "onde", "quando", "porque", "pode", "podem", "consegue", "conseguem", "favor", "obrigado",
  "vou", "querer", "quer", "queremos", "preciso", "precisava", "precisando", "separa", "separar", "traz",
  "trazer", "leva", "levar", "pegar", "mim", "nos", "gente", "uns", "umas", "duas", "dois", "tres",
]);

// Apelidos → como costuma estar no nome/categoria do produto
const PRODUCT_SYNONYMS: Record<string, string[]> = {
  breja: ["cerveja"], brejas: ["cerveja"], ceva: ["cerveja"], cerva: ["cerveja"], cervejinha: ["cerveja"],
  beer: ["cerveja"], refri: ["refrigerante", "refri"], refris: ["refrigerante", "refri"],
  latinha: ["lata"], latao: ["latao", "473"], litrao: ["litrao", "1l", "1000ml"], long: ["long"],
  uisque: ["whisky"], wisky: ["whisky"], whiskey: ["whisky"], uisk: ["whisky"], vodca: ["vodka"],
  pinga: ["cachaca", "pinga"], cachaca: ["cachaca", "pinga"], energy: ["energetico"],
  agua: ["agua"], aguas: ["agua"], cigarro: ["cigarro"], cigarros: ["cigarro"],
};

export function searchTokens(text: string): string[] {
  // Número de 1–2 dígitos é quantidade ("5 brahmas"); tamanho fica ("brahma 600")
  return textTokens(text).filter((t) => t.length >= 2 && !SEARCH_NOISE.has(t) && !/^\d{1,2}$/.test(t));
}

function productMatchesToken(token: string, text: string, compact: string, words: string[]): boolean {
  for (const alt of PRODUCT_SYNONYMS[token] ?? [token, singular(token)]) {
    if (text.includes(alt) || compact.includes(alt)) return true;
  }
  return words.some((w) => fuzzyEqual(token, w));
}

export interface ProductSearch {
  items: BotProduct[];
  total: number;
  partial: boolean; // não achou com todas as palavras; mostra o mais parecido
}

/**
 * Procura pelo nome e pela categoria. Aceita plural, apelido ("breja",
 * "refri") e erro de digitação. Se nada bate com TODAS as palavras, mostra
 * o que bate com a maioria (partial).
 */
export function findProducts(products: BotProduct[], tokens: string[], allowPartial = true): ProductSearch {
  if (!tokens.length) return { items: [], total: 0, partial: false };
  const scored = products.map((p) => {
    const text = normalizeText(`${p.name} ${p.category ?? ""}`);
    const compact = text.replace(/ /g, ""); // "para tudo" ~ "paratudo"
    const words = text.split(" ");
    return { p, score: tokens.filter((t) => productMatchesToken(t, text, compact, words)).length };
  });
  let best = tokens.length;
  let matches = scored.filter((s) => s.score === best);
  let partial = false;
  if (!matches.length && allowPartial && tokens.length >= 2) {
    best = Math.max(...scored.map((s) => s.score), 0);
    if (best >= Math.ceil(tokens.length / 2)) {
      matches = scored.filter((s) => s.score === best);
      partial = true;
    }
  }
  // Disponível primeiro; depois o nome mais curto (o mais "exato")
  const items = matches
    .map((s) => s.p)
    .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0) || a.name.length - b.name.length);
  return { items: items.slice(0, MAX_PRODUCTS_LISTED), total: items.length, partial };
}

/** Compatível com a versão anterior: só os produtos encontrados. */
export function searchProducts(products: BotProduct[], text: string): BotProduct[] {
  return findProducts(products, searchTokens(text), false).items;
}

function productLine(p: BotProduct): string {
  const price = p.promotion && p.old_price
    ? `${formatBRL(p.price)} (de ${formatBRL(p.old_price)})`
    : formatBRL(p.price);
  return `• ${p.name} — ${price} ${p.stock > 0 ? "✅ disponível" : "❌ em falta"}`;
}

function productsReply(found: ProductSearch, query: string, siteUrl: string | null): string {
  const q = query.trim().slice(0, 40);
  const title = found.partial
    ? `🔎 Não achei exatamente "${q}", mas veja os parecidos:`
    : found.total > 1
    ? `🔎 Encontrei ${found.total} produtos para "${q}":`
    : `🔎 Resultado para "${q}":`;
  const lines = [title, "", ...found.items.map(productLine)];
  if (found.total > found.items.length) {
    lines.push(`… e mais ${found.total - found.items.length}. Digite o nome completo para filtrar.`);
  }
  if (siteUrl) lines.push("", `🛒 Peça pelo site: ${siteUrl}`);
  return lines.join("\n");
}

function promotionsReply(products: BotProduct[], siteUrl: string | null): string {
  const promos = products
    .filter((p) => p.promotion && p.old_price && p.old_price > p.price && p.stock > 0)
    .sort((a, b) => (b.old_price! - b.price) / b.old_price! - (a.old_price! - a.price) / a.old_price!);
  if (!promos.length) {
    return siteUrl
      ? `🏷️ No momento não há promoções ativas. Veja todos os produtos no site: ${siteUrl}`
      : "🏷️ No momento não há promoções ativas.";
  }
  const lines = ["🏷️ *Promoções*", "", ...promos.slice(0, MAX_PRODUCTS_LISTED).map(productLine)];
  if (promos.length > MAX_PRODUCTS_LISTED) lines.push(`… e mais ${promos.length - MAX_PRODUCTS_LISTED} no site.`);
  if (siteUrl) lines.push("", `🛒 Peça pelo site: ${siteUrl}`);
  return lines.join("\n");
}

// ── Pedido ──────────────────────────────────────────────────

/** Chave de comparação de telefone: DDD + últimos 8 dígitos (ignora o 9º e o 55). */
export function phoneKey(raw: string | null | undefined): string | null {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length !== 10 && digits.length !== 11) return null;
  return digits.slice(0, 2) + digits.slice(-8);
}

const STATUS_LABELS: Record<string, string> = {
  pending: "🕐 Aguardando confirmação da loja",
  preparing: "👨‍🍳 Em preparo",
  on_the_way: "🛵 Saiu para entrega",
  delivered: "✅ Entregue",
  rejected: "❌ Recusado pela loja",
  cancelled: "🚫 Cancelado",
};
const PICKUP_STATUS_LABELS: Record<string, string> = {
  ...STATUS_LABELS,
  pending: "🕐 Aguardando retirada",
  delivered: "✅ Retirado",
};

function orderReply(orders: RecentOrder[], fromPhone: string, store: StoreInfo, now: Date): string {
  const key = phoneKey(fromPhone);
  const order = key
    ? orders
      .filter((o) => phoneKey(o.address?.phone) === key)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    : undefined;

  if (!order) {
    const lines = [
      "📦 Não encontrei pedido recente feito com este número (últimos 2 dias).",
    ];
    if (store.whatsapp) lines.push("", `Se pediu com outro telefone, fale com o atendente: ${waLink(store.whatsapp)}`);
    return lines.join("\n");
  }

  const labels = order.address?.isRetirada ? PICKUP_STATUS_LABELS : STATUS_LABELS;
  const created = new Date(order.created_at);
  const c = localTime(created);
  const n = localTime(now);
  const sameDay = c.year === n.year && c.month === n.month && c.day === n.day;
  const when = sameDay ? "hoje" : `em ${String(c.day).padStart(2, "0")}/${String(c.month).padStart(2, "0")}`;
  const time = created.toLocaleTimeString("pt-BR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  const lines = [
    `📦 *Pedido #${order.order_number}*`,
    "",
    labels[order.status] ?? order.status,
    `Feito ${when} às ${time} · Total ${formatBRL(order.total)}`,
  ];
  if (["pending", "preparing", "on_the_way"].includes(order.status) && store.whatsapp) {
    lines.push("", `Alguma dúvida sobre o pedido? Fale com o atendente: ${waLink(store.whatsapp)}`);
  }
  return lines.join("\n");
}

// ── Menu ────────────────────────────────────────────────────

export function menuRows(store: StoreInfo): MenuRow[] {
  const rows: MenuRow[] = [
    { id: "horario", title: "🕐 Horário", description: "Estamos abertos? Horários da semana" },
    { id: "entrega", title: "🛵 Entrega e taxas", description: "Bairros atendidos e valores" },
    { id: "produto", title: "🔎 Consultar produto", description: "Preço e disponibilidade" },
    { id: "promocao", title: "🏷️ Promoções", description: "Ofertas do momento" },
    { id: "pedido", title: "📦 Meu pedido", description: "Situação do último pedido" },
    { id: "pagamento", title: "💳 Formas de pagamento" },
  ];
  if (store.pickupAddress) rows.push({ id: "endereco", title: "📍 Endereço da loja" });
  if (store.siteUrl) rows.push({ id: "site", title: "🛒 Fazer pedido", description: "Peça pelo nosso site" });
  if (store.whatsapp) rows.push({ id: "atendente", title: "💬 Falar com atendente" });
  return rows.slice(0, 10); // limite da Meta
}

function menu(store: StoreInfo, intro?: string): BotReply {
  const body = intro ??
    `Olá! 👋 Este é o atendimento automático da *${store.name}*.\n\n` +
      "Toque em *Ver opções* ou escreva sua dúvida (ex: *tem heineken?*, *entrega no centro?*, *abre domingo?*).";
  return { type: "list", body: body.slice(0, INTERACTIVE_BODY_MAX), button: "Ver opções", rows: menuRows(store) };
}

/** Resposta com o botão "Ver menu"; texto longo demais vira texto simples. */
function answer(body: string): BotReply {
  return body.length <= INTERACTIVE_BODY_MAX
    ? { type: "buttons", body }
    : { type: "text", body: body.slice(0, TEXT_BODY_MAX) };
}

// ── Intenções por texto livre ───────────────────────────────

// Mensagem só de cumprimento ("ola, bom dia", "oi tudo bem?")
const GREETING_WORDS = new Set([
  "oi", "oii", "oie", "ola", "opa", "eai", "e", "ai", "bom", "boa", "dia", "tarde", "noite", "tudo", "bem",
  "hello", "hi", "salve", "pessoal", "galera", "menu", "inicio", "ajuda", "opcoes", "opcao", "voltar",
  "comecar", "como", "vai", "voces", "estao", "beleza", "amigo", "amiga", "moco", "moca", "boas",
]);
// Precisa de pelo menos uma destas ("tudo bem" sozinho não basta)
const GREETING_CORE = new Set([
  "oi", "oii", "oie", "ola", "opa", "eai", "bom", "boa", "hello", "hi", "salve", "menu", "inicio", "ajuda",
  "opcoes", "opcao", "voltar", "comecar", "boas",
]);

// Agradecimento/confirmação/despedida: responde curto, sem o menu inteiro
const THANKS_CORE = new Set([
  "obrigado", "obrigada", "valeu", "beleza", "ok", "okay", "okk", "show", "top", "certo", "perfeito",
  "tmj", "tchau", "flw", "falou", "entendi", "combinado", "otimo", "legal", "massa", "joia", "sim",
  "agradeco", "grato", "grata", "blz", "ta", "fechou", "bele", "tranquilo", "suave",
]);
const THANKS_WORDS = new Set([
  ...THANKS_CORE, "muito", "pela", "pelo", "ajuda", "informacao", "mano", "irmao", "amigo", "amiga", "de",
  "nada", "kk", "kkk", "kkkk", "rs", "rsrs", "bom", "bem", "entao", "so", "isso", "era", "e", "ate", "mais",
  "logo", "depois", "a", "o", "por", "tudo", "obrigadao", "demais", "voce", "voces", "nos", "otima",
]);
const GOODBYE = new Set(["tchau", "flw", "falou", "ate"]);
const GRATITUDE = new Set(["obrigado", "obrigada", "valeu", "agradeco", "grato", "grata", "obrigadao", "tmj"]);

interface IntentDef {
  id: string;
  words: string[]; // palavra solta (aceita plural e erro de digitação)
  phrases: string[]; // sequência exata
}

// A ordem é a ordem das respostas quando a mensagem tem mais de uma dúvida.
const INTENTS: IntentDef[] = [
  {
    id: "pedido",
    words: ["pedido", "rastrear", "acompanhar", "atrasado", "atraso", "demorando", "previsao", "chegando"],
    phrases: ["cade meu", "cade o meu", "nao chegou", "ainda nao chegou", "ja saiu", "vai demorar", "esta vindo",
      "ta vindo", "minha compra", "meu delivery"],
  },
  {
    id: "horario",
    words: ["horario", "abre", "abrem", "abriu", "aberto", "aberta", "abertos", "fecha", "fecham", "fechado",
      "fechada", "fechados", "fechou", "funcionamento", "funcionando", "expediente", "feriado"],
    phrases: ["que horas", "ate que horas", "ate quando", "ate que hora", "que hora", "hora abre",
      "estao abertos", "estao funcionando", "estao atendendo", "ta atendendo"],
  },
  {
    id: "entrega",
    words: ["entrega", "entregam", "entregar", "entregamos", "entregas", "frete", "taxa", "bairro",
      "delivery", "cep", "levam", "mandam", "entregador", "motoboy"],
    phrases: ["manda pra", "manda para", "leva ate", "levam ate", "chega ate", "atende minha regiao",
      "atendem minha regiao"],
  },
  {
    id: "pagamento",
    words: ["pagamento", "pagar", "pago", "pix", "cartao", "credito", "debito", "dinheiro", "troco",
      "maquininha", "maquina", "aceita", "aceitam", "parcelar", "parcela", "vr", "alimentacao",
      "refeicao", "picpay", "boleto"],
    phrases: ["forma de pagamento", "formas de pagamento"],
  },
  {
    id: "endereco",
    words: ["endereco", "localizacao", "retirar", "retirada", "buscar", "mapa", "localiza"],
    phrases: ["onde fica", "onde voces ficam", "onde e a loja", "fica onde", "como chegar", "onde e",
      "pegar ai", "passar ai", "ir ai", "pegar na loja", "onde voces estao"],
  },
  {
    id: "atendente",
    words: ["atendente", "humano", "gerente", "dono", "responsavel", "reclamacao", "reclamar", "problema",
      "ligar", "telefone", "contato", "atendimento", "whatsapp", "errado", "errada", "faltou", "faltando"],
    phrases: ["falar com", "pessoa de verdade", "alguem ai", "falar com alguem"],
  },
  {
    id: "promocao",
    words: ["promocao", "promocoes", "oferta", "ofertas", "desconto", "descontos", "promo", "cupom"],
    phrases: [],
  },
  {
    id: "site",
    words: ["site", "link", "cardapio", "catalogo", "comprar", "encomendar", "encomenda", "aplicativo",
      "app", "pedir"],
    phrases: ["fazer pedido", "fazer um pedido", "quero pedir", "como pedir", "como faco", "como compro",
      "fazer uma compra", "fazer compra"],
  },
];

function isIntentWord(t: string): boolean {
  return INTENTS.some((i) => i.words.some((w) => (w.length <= 3 ? t === w : fuzzyEqual(t, w))));
}

export interface IntentMatch {
  id: string;
  used: string[]; // palavras da mensagem que levaram a esta intenção
}

/** Todas as dúvidas reconhecidas na mensagem, na ordem de INTENTS. */
export function detectIntents(tokens: string[]): IntentMatch[] {
  const text = ` ${tokens.join(" ")} `;
  const found: IntentMatch[] = [];
  for (const intent of INTENTS) {
    const used = new Set<string>();
    for (const phrase of intent.phrases) {
      if (text.includes(` ${phrase} `)) phrase.split(" ").forEach((w) => used.add(w));
    }
    for (const t of tokens) {
      if (intent.words.some((w) => (w.length <= 3 ? t === w : fuzzyEqual(t, w)))) used.add(t);
    }
    if (used.size) found.push({ id: intent.id, used: [...used] });
  }
  // "fazer um pedido" é pedido novo (site), não acompanhar pedido
  const ids = found.map((f) => f.id);
  if (ids.includes("site") && ids.includes("pedido") && !/ (meu|minha|cade|chegou|saiu|demor)/.test(text)) {
    return found.filter((f) => f.id !== "pedido");
  }
  return found;
}

/** Classificação simples (usada nos testes): menu, thanks, uma intenção ou null. */
export function detectIntent(text: string): string | null {
  const tokens = textTokens(text);
  if (isGreeting(tokens)) return "menu";
  if (isThanks(tokens)) return "thanks";
  return detectIntents(tokens)[0]?.id ?? null;
}

function isGreeting(tokens: string[]): boolean {
  if (!tokens.length) return true;
  return tokens.every((t) => GREETING_WORDS.has(t)) && tokens.some((t) => GREETING_CORE.has(t));
}

function isThanks(tokens: string[]): boolean {
  if (!tokens.length) return false;
  const text = tokens.join(" ");
  if (["ate mais", "ate logo", "ate amanha", "ate depois", "ta bom", "ta bem", "tudo certo"].includes(text)) return true;
  return tokens.every((t) => THANKS_WORDS.has(t)) && tokens.some((t) => THANKS_CORE.has(t));
}

// Emojis de "ok/obrigado" mandados sozinhos
const THANKS_EMOJI = /[👍🙏❤💙💚😊🙂😉👌✅🤝💪😁😀😄🥰😍👏]/u;

// ── Resposta ────────────────────────────────────────────────

/** Texto da resposta para uma opção do menu (ou intenção reconhecida). */
async function optionText(
  id: string,
  data: BotData,
  fromPhone: string,
  now: Date,
  tokens: string[] = [],
): Promise<string | null> {
  const { store } = data;
  switch (id) {
    case "horario": {
      const [hours, config] = await Promise.all([data.hours(), data.config()]);
      return hoursReply(hours, config, now, tokens);
    }
    case "entrega": {
      const [zones, config] = await Promise.all([data.zones(), data.config()]);
      return deliveryReply(zones, config, tokens);
    }
    case "pagamento":
      return paymentReply(await data.config());
    case "produto":
      return "🔎 Digite o nome do produto que você procura (ex: *heineken lata*, *coca 2L* ou *cerveja*).";
    case "promocao":
      return promotionsReply(await data.products(), store.siteUrl);
    case "pedido":
      return orderReply(await data.recentOrders(), fromPhone, store, now);
    case "endereco":
      return store.pickupAddress
        ? ["📍 *Endereço da loja*", "", store.pickupAddress, store.pickupAddressDetail].filter(Boolean).join("\n")
        : "📍 Fale com o atendente para saber o endereço.";
    case "site":
      return store.siteUrl ? `🛒 Faça seu pedido pelo site:\n${store.siteUrl}` : "🛒 Fale com o atendente para fazer seu pedido.";
    case "atendente":
      return store.whatsapp
        ? `💬 Fale com nosso atendente pelo WhatsApp:\n${waLink(store.whatsapp)}`
        : "💬 No momento o atendimento é só por aqui.";
    default:
      return null;
  }
}

// Respostas que terminam com o link do site para comprar
const SITE_LINK_INTENTS = new Set(["horario", "entrega", "pagamento", "endereco", "promocao", "produtos"]);

/** Põe "Peça pelo site" no final — uma vez só, mesmo com várias respostas juntas. */
function withSiteLink(body: string, ids: string[], store: StoreInfo): string {
  if (!store.siteUrl || body.includes(store.siteUrl) || !ids.some((id) => SITE_LINK_INTENTS.has(id))) return body;
  return `${body}\n\n🛒 Peça pelo site: ${store.siteUrl}`;
}

function notUnderstood(store: StoreInfo, text: string, tokens: string[]): BotReply {
  const query = text.trim().slice(0, 40);
  const n = searchTokens(text).length;
  const looksLikeProduct = n >= 1 && n <= 3;
  let body = looksLikeProduct
    ? `Não encontrei nenhum produto com "${query}". 🤔\n\nConfira o nome (ex: *heineken lata*) ou toque em *Ver opções*.`
    : "Desculpe, não entendi sua mensagem. 🤔\n\nToque em *Ver opções* para ver o que posso responder.";
  if (store.whatsapp) body += `\n\nSe preferir, fale com o atendente: ${waLink(store.whatsapp)}`;
  return menu(store, body);
}

const MEDIA_INTRO: Record<string, string> = {
  audio: "🎙️ Ainda não consigo ouvir áudios.",
  voice: "🎙️ Ainda não consigo ouvir áudios.",
  image: "📷 Ainda não consigo ver imagens.",
  video: "🎬 Ainda não consigo ver vídeos.",
  sticker: "😄",
  document: "📄 Ainda não consigo abrir arquivos.",
  location: "📍 Recebi sua localização, mas ainda não consigo usá-la.",
};

export async function buildReply(
  input: BotInput,
  data: BotData,
  fromPhone: string,
  now: Date = new Date(),
): Promise<BotReply> {
  const { store } = data;

  if (input.kind === "other") {
    const intro = input.media ? MEDIA_INTRO[input.media] : undefined;
    return menu(store, intro ? `${intro} Escreva sua dúvida ou toque em *Ver opções*.` : undefined);
  }
  if (input.kind === "choice") {
    const body = await optionText(input.id, data, fromPhone, now);
    return body ? answer(withSiteLink(body, [input.id], store)) : menu(store);
  }

  const text = input.text;
  const tokens = textTokens(text);

  // Só emoji / só pontuação
  if (!tokens.length) {
    return THANKS_EMOJI.test(text) ? { type: "text", body: "😊 Se precisar de algo, é só mandar *menu*." } : menu(store);
  }
  if (isGreeting(tokens)) return menu(store);
  if (isThanks(tokens)) {
    const body = tokens.some((t) => GOODBYE.has(t))
      ? "Até mais! 👋 Quando precisar, é só chamar."
      : tokens.some((t) => GRATITUDE.has(t))
      ? "Por nada! 😊 Se precisar de algo, é só mandar *menu*."
      : "Certo! 😊 Se precisar de algo, é só mandar *menu*.";
    return { type: "text", body };
  }

  // Número do menu ("1", "2"...)
  if (tokens.length === 1 && /^\d{1,2}$/.test(tokens[0])) {
    const row = menuRows(store)[Number(tokens[0]) - 1];
    if (row) {
      const body = await optionText(row.id, data, fromPhone, now);
      if (body) return answer(withSiteLink(body, [row.id], store));
    }
  }

  const intents = detectIntents(tokens);

  // Produto citado junto com a dúvida ("tem heineken pra entregar no centro?")
  // (sem as palavras da dúvida nem o bairro citado)
  const skip = new Set([...intents.flatMap((i) => i.used), ...(placeMentioned(tokens)?.split(" ") ?? [])]);
  const productTokens = searchTokens(text).filter((t) => !skip.has(t));
  const onlySite = intents.length > 0 && intents.every((i) => i.id === "site");

  if (!intents.length || onlySite) {
    const found = findProducts(await data.products(), productTokens);
    if (found.total) return answer(productsReply(found, productTokens.join(" "), store.siteUrl));
    if (!intents.length) return notUnderstood(store, text, tokens);
  }

  const parts: string[] = [];
  const answered = intents.slice(0, 3).map((i) => i.id);
  for (const intent of intents.slice(0, 3)) {
    const body = await optionText(intent.id, data, fromPhone, now, tokens);
    if (body) parts.push(body);
  }
  if (productTokens.length && !onlySite && !intents.some((i) => i.id === "promocao")) {
    const found = findProducts(await data.products(), productTokens, false);
    if (found.total) {
      parts.unshift(productsReply(found, productTokens.join(" "), null));
      answered.push("produtos");
    }
  }
  return parts.length ? answer(withSiteLink(parts.join("\n\n"), answered, store)) : menu(store);
}
