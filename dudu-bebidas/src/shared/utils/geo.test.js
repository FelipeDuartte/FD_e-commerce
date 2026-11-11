import { describe, expect, it, vi } from "vitest";
import { estimateEtaMinutes, formatAddressText, haversineDistanceKm } from "./geo";

describe("haversineDistanceKm", () => {
  it("1 grau de longitude no equador ≈ 111 km", () => {
    expect(haversineDistanceKm(0, 0, 0, 1)).toBeCloseTo(111.19, 1);
  });
  it("mesmo ponto = 0", () => {
    expect(haversineDistanceKm(-19.92, -43.94, -19.92, -43.94)).toBe(0);
  });
});

describe("estimateEtaMinutes", () => {
  it("considera 25 km/h", () => {
    // ~2,2 km em linha reta (Praça Sete → Savassi, BH) ≈ 5 min
    expect(estimateEtaMinutes(-19.9191, -43.9386, -19.9386, -43.9345)).toBe(5);
  });
  it("nunca menos de 1 minuto", () => {
    expect(estimateEtaMinutes(-19.92, -43.94, -19.92, -43.94)).toBe(1);
  });
});

describe("formatAddressText", () => {
  it("junta só os campos preenchidos", () => {
    expect(formatAddressText({ street: "Rua A", number: "10", district: "", city: "BH", state: "MG" }))
      .toBe("Rua A, 10, BH, MG");
  });
  it("endereço ausente vira texto vazio", () => {
    expect(formatAddressText(null)).toBe("");
  });
});

// O token é lido quando o módulo carrega — cada teste recarrega o geo.js
// com o token que quer (sem depender do .env de quem roda o teste).
async function loadGeo(token) {
  vi.resetModules();
  vi.stubEnv("VITE_MAPBOX_TOKEN", token);
  return import("./geo");
}

describe("geocodeAddress", () => {
  it("sem token do Mapbox devolve null sem chamar a internet", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const geo = await loadGeo("");
    expect(await geo.geocodeAddress("Rua A, 10")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("endereço vazio não consulta", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const geo = await loadGeo("token-teste");
    expect(await geo.geocodeAddress("   ")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("converte o [lng, lat] do Mapbox em { lat, lng }", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{ center: [-43.94, -19.92] }] }),
    }));
    const geo = await loadGeo("token-teste");
    expect(await geo.geocodeAddress("Rua A, 10")).toEqual({ lat: -19.92, lng: -43.94 });
  });

  it("falha da API vira null (nunca trava a atribuição do entregador)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const geo = await loadGeo("token-teste");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect(await geo.geocodeAddress("Rua A, 10")).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("sem internet")));
    expect(await geo.geocodeAddress("Rua A, 10")).toBeNull();
  });
});
