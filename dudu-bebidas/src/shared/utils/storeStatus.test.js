import { describe, expect, it } from "vitest";
import { getStoreStatus, isBeforeNoon, isStoreOpen } from "./storeStatus";

// Versão estática (fallback sem banco): fecha segunda, domingo e feriado
const at = (day, hour = 12) => new Date(2026, 10, day, hour);

describe("getStoreStatus (fallback sem banco)", () => {
  it("fecha segunda e domingo", () => {
    expect(getStoreStatus(at(9)).reason).toBe("monday");
    expect(getStoreStatus(at(8)).reason).toBe("sunday");
  });

  it("fecha em feriado", () => {
    expect(getStoreStatus(at(20)).reason).toBe("holiday");
  });

  it("abre nos outros dias", () => {
    expect(isStoreOpen(at(11))).toBe(true);
  });
});

describe("isBeforeNoon", () => {
  it("meio-dia em ponto já não conta", () => {
    expect(isBeforeNoon(at(11, 11))).toBe(true);
    expect(isBeforeNoon(at(11, 12))).toBe(false);
  });
});
