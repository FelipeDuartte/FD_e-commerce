import { describe, expect, it } from "vitest";
import { isHoliday } from "./holidays";

// new Date(ano, mês-1, dia, hora) = horário local (Brasília, ver vite.config.js)
const day = (y, m, d) => new Date(y, m - 1, d, 12, 0);

describe("isHoliday", () => {
  it.each([
    ["Ano Novo", day(2026, 1, 1)],
    ["Tiradentes", day(2026, 4, 21)],
    ["Dia do Trabalhador", day(2026, 5, 1)],
    ["Independência", day(2026, 9, 7)],
    ["Nossa Senhora Aparecida", day(2026, 10, 12)],
    ["Finados", day(2026, 11, 2)],
    ["Proclamação da República", day(2026, 11, 15)],
    ["Consciência Negra", day(2026, 11, 20)],
    ["Natal", day(2026, 12, 25)],
  ])("feriado fixo: %s", (_, date) => {
    expect(isHoliday(date)).toBe(true);
  });

  it.each([
    ["Carnaval 2026", day(2026, 2, 17)],
    ["Sexta-feira Santa 2026", day(2026, 4, 3)],
    ["Páscoa 2026", day(2026, 4, 5)],
    ["Corpus Christi 2026", day(2026, 6, 4)],
    ["Sexta-feira Santa 2027", day(2027, 3, 26)],
  ])("feriado móvel (calculado pela Páscoa): %s", (_, date) => {
    expect(isHoliday(date)).toBe(true);
  });

  it("dia comum não é feriado", () => {
    expect(isHoliday(day(2026, 11, 11))).toBe(false);
    expect(isHoliday(day(2026, 12, 24))).toBe(false);
  });

  it("funciona para qualquer ano, não só o atual e o próximo", () => {
    expect(isHoliday(day(2030, 12, 25))).toBe(true);
    expect(isHoliday(day(2030, 4, 19))).toBe(true); // Sexta-feira Santa 2030
    expect(isHoliday(day(2024, 12, 25))).toBe(true);
  });

  it("vale o dia inteiro no horário de Brasília (inclusive 23h59)", () => {
    expect(isHoliday(new Date(2026, 11, 25, 0, 0))).toBe(true);
    expect(isHoliday(new Date(2026, 11, 25, 23, 59))).toBe(true);
    expect(isHoliday(new Date(2026, 11, 26, 0, 0))).toBe(false);
  });
});
