import { isHoliday } from "./holidays";

export const STORE_STATUS = {
  open: {
    open: true,
    reason: "open",
    message: null,
    shortMessage: null,
  },
  monday: {
    open: false,
    reason: "monday",
    message:
      "Hoje é segunda-feira — a loja está fechada. Não é possível finalizar pedidos.",
    shortMessage: "Fechado (segunda)",
  },
  sunday: {
    open: false,
    reason: "sunday",
    message:
      "Hoje é domingo — a loja está fechada. Não é possível finalizar pedidos.",
    shortMessage: "Fechado (domingo)",
  },
  holiday: {
    open: false,
    reason: "holiday",
    message:
      "Hoje é feriado — a loja está fechada. Não é possível finalizar pedidos.",
    shortMessage: "Fechado (feriado)",
  },
};

export function isMonday(date = new Date()) {
  return date.getDay() === 1; // 0=Dom,1=Seg,...
}

export function isSunday(date = new Date()) {
  return date.getDay() === 0;
}

export function isBeforeNoon(date = new Date()) {
  // Permite compra até 12:00 (meio-dia). Aqui consideramos hora < 12.
  return date.getHours() < 12;
}

// ── Versão estática (backward-compatible) ─────────────────────────────────────
// Mantém o comportamento original: fecha segunda, domingo e feriados.
// Usada como fallback se o banco de dados não estiver disponível.
export function getStoreStatus(date = new Date()) {
  if (isMonday(date)) return STORE_STATUS.monday;
  if (isHoliday(date)) return STORE_STATUS.holiday;
  if (isSunday(date)) return STORE_STATUS.sunday;
  return STORE_STATUS.open;
}

// Retorna se é permitido efetuar compra no momento atual
export function isPurchaseAllowed(date = new Date()) {
  return getStoreStatus(date).open;
}

export function isStoreOpen(date = new Date()) {
  // Compatível com usos existentes no projeto
  return isPurchaseAllowed(date);
}
