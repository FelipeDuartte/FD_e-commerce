import { describe, expect, it } from "vitest";
import { formatBRL } from "./format";

// O Intl usa espaço normal aqui (o "R$ " é fixo no código)
describe("formatBRL", () => {
  it.each([
    [0, "R$ 0,00"],
    [5.5, "R$ 5,50"],
    [1500, "R$ 1.500,00"],
    [1234567.891, "R$ 1.234.567,89"],
    [0.1 + 0.2, "R$ 0,30"],
    ["12.9", "R$ 12,90"],
  ])("%s → %s", (value, expected) => {
    expect(formatBRL(value)).toBe(expected);
  });
});
