import { describe, expect, it } from "vitest";
import { createStoreChecker } from "./storeChecker";

// Segunda e domingo fechados; terça a sábado 09:00–19:00 (formato do banco)
const HOURS = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day_of_week: day,
  is_open: day !== 0 && day !== 1,
  open_time: "09:00:00",
  close_time: "19:00:00",
}));
const CONFIG = { close_on_holidays: true };

// Novembro de 2026: dia 8 é domingo
const at = (day, hour, minute = 0) => new Date(2026, 10, day, hour, minute);
const QUARTA = 11;
const TERCA = 10;

describe("createStoreChecker", () => {
  const checker = createStoreChecker(CONFIG, HOURS);

  it("aberto dentro do horário", () => {
    expect(checker.getStatus(at(QUARTA, 10))).toMatchObject({ open: true, reason: "open" });
  });

  it("abre exatamente no horário de abertura", () => {
    expect(checker.isOpen(at(QUARTA, 9, 0))).toBe(true);
    expect(checker.isOpen(at(QUARTA, 8, 59))).toBe(false);
  });

  it("fecha exatamente no horário de fechamento", () => {
    expect(checker.isOpen(at(QUARTA, 18, 59))).toBe(true);
    expect(checker.getStatus(at(QUARTA, 19, 0))).toMatchObject({ open: false, reason: "after_hours" });
  });

  it("antes de abrir avisa o horário de abertura", () => {
    expect(checker.getStatus(at(QUARTA, 7))).toMatchObject({
      open: false,
      reason: "before_hours",
      shortMessage: "Abre às 09:00",
    });
  });

  it("domingo e segunda fechados usam a mensagem própria", () => {
    expect(checker.getStatus(at(8, 12)).reason).toBe("sunday");
    expect(checker.getStatus(at(9, 12)).reason).toBe("monday");
  });

  it("outro dia marcado como fechado", () => {
    const hours = HOURS.map((h) => (h.day_of_week === 2 ? { ...h, is_open: false } : h));
    expect(createStoreChecker(CONFIG, hours).getStatus(at(TERCA, 12)).reason).toBe("closed_day");
  });

  it("feriado fecha quando a loja fecha em feriado", () => {
    const finados = at(20, 12); // sexta, Consciência Negra
    expect(checker.getStatus(finados).reason).toBe("holiday");
    expect(createStoreChecker({ close_on_holidays: false }, HOURS).isOpen(finados)).toBe(true);
  });

  it("horário vazio no banco usa 09:00–19:00", () => {
    const hours = [{ day_of_week: 3, is_open: true, open_time: null, close_time: null }];
    const c = createStoreChecker(CONFIG, hours);
    expect(c.isOpen(at(QUARTA, 8))).toBe(false);
    expect(c.isOpen(at(QUARTA, 12))).toBe(true);
  });

  it("dia sem configuração fica aberto (sem dados não bloqueia a venda)", () => {
    expect(createStoreChecker(null, null).isOpen(at(QUARTA, 3))).toBe(true);
  });

  it("isPurchaseAllowed segue o mesmo status", () => {
    expect(checker.isPurchaseAllowed(at(QUARTA, 10))).toBe(true);
    expect(checker.isPurchaseAllowed(at(QUARTA, 20))).toBe(false);
  });
});
