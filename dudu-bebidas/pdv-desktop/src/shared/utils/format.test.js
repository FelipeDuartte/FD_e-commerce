import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatLastOrder, formatPhone } from "./format";

describe("formatPhone", () => {
  it.each([
    ["31999450717", "(31) 99945-0717"],
    ["3134510200", "(31) 3451-0200"],
    ["(31) 99945-0717", "(31) 99945-0717"],
    ["123", "123"],
    ["", ""],
    [null, ""],
  ])("%s → %s", (raw, expected) => {
    expect(formatPhone(raw)).toBe(expected);
  });
});

describe("formatLastOrder", () => {
  // Relógio parado: o resultado não depende do dia em que o teste roda
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 11, 15, 0));
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    [null, "nunca comprou"],
    [new Date(2026, 10, 11, 9, 0).toISOString(), "última compra hoje"],
    [new Date(2026, 10, 10, 9, 0).toISOString(), "última compra ontem"],
    [new Date(2026, 10, 1, 9, 0).toISOString(), "última compra há 10 dias"],
  ])("%s → %s", (iso, expected) => {
    expect(formatLastOrder(iso)).toBe(expected);
  });
});
