// Utils para horário de funcionamento
// Gera feriados nacionais do Brasil (fixos + móveis) para o ano atual
// e o próximo. Ajuste se quiser adicionar feriados municipais/estaduais.

function localISODate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Cálculo da Páscoa (algoritmo de Meeus)
function easterDate(year) {
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
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function generateHolidays(year) {
  const easter = easterDate(year);
  const goodFriday = addDays(easter, -2);
  const carnivalTuesday = addDays(easter, -47);
  const corpusChristi = addDays(easter, 60);

  const fixed = [
    `${year}-01-01`, // Ano Novo
    `${year}-04-21`, // Tiradentes
    `${year}-05-01`, // Dia do Trabalhador
    `${year}-09-07`, // Independência
    `${year}-10-12`, // Nossa Senhora Aparecida
    `${year}-11-02`, // Finados
    `${year}-11-15`, // Proclamação da República
    `${year}-12-25`, // Natal
  ];

  const movable = [
    localISODate(carnivalTuesday),
    localISODate(goodFriday),
    localISODate(easter),
    localISODate(corpusChristi),
  ];

  // Opcional: incluir Dia da Consciência Negra (20/11) — observado em muitos municípios/estados
  movable.push(`${year}-11-20`);

  return [...fixed, ...movable];
}

const now = new Date();
const HOLIDAYS = [
  ...generateHolidays(now.getFullYear()),
  ...generateHolidays(now.getFullYear() + 1),
];

export function isMonday(date = new Date()) {
  return date.getDay() === 1; // 0=Dom,1=Seg,...
}

export function isSunday(date = new Date()) {
  return date.getDay() === 0;
}

export function isHoliday(date = new Date()) {
  const iso = localISODate(date);
  return HOLIDAYS.includes(iso);
}

export function isBeforeNoon(date = new Date()) {
  // Permite compra até 12:00 (meio-dia). Aqui consideramos hora < 12.
  return date.getHours() < 12;
}

// Retorna se é permitido efetuar compra no momento atual
export function isPurchaseAllowed(date = new Date()) {
  if (isMonday(date)) return false; // regra existente: fechado às segundas
  if (isSunday(date) || isHoliday(date)) {
    return isBeforeNoon(date);
  }
  return true;
}

export function isStoreOpen(date = new Date()) {
  // Compatível com usos existentes no projeto
  return isPurchaseAllowed(date);
}

export default {
  isMonday,
  isSunday,
  isHoliday,
  isBeforeNoon,
  isPurchaseAllowed,
  isStoreOpen,
  HOLIDAYS,
};
