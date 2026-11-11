// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const shareLocation = vi.hoisted(() => vi.fn());
vi.mock("../services/courierService", () => ({ shareLocation }));

const { useLocationSharing } = await import("./useLocationSharing");

// GPS de mentira: o teste dispara posição ou erro quando quiser
let gps;
function fakeGeolocation() {
  const watchers = new Map();
  let nextId = 1;
  return {
    watchPosition: vi.fn((onPos, onErr) => {
      const id = nextId++;
      watchers.set(id, { onPos, onErr });
      return id;
    }),
    clearWatch: vi.fn((id) => watchers.delete(id)),
    getCurrentPosition: vi.fn(),
    move: (lat, lng) => watchers.forEach((w) => w.onPos({ coords: { latitude: lat, longitude: lng } })),
    deny: () => watchers.forEach((w) => w.onErr({ code: 1, PERMISSION_DENIED: 1 })),
    active: () => watchers.size,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  gps = fakeGeolocation();
  vi.stubGlobal("navigator", { geolocation: gps });
  vi.spyOn(console, "error").mockImplementation(() => {});
  shareLocation.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("useLocationSharing", () => {
  it("parado (sem entrega em andamento): não liga o GPS", () => {
    renderHook(() => useLocationSharing(false));
    expect(gps.watchPosition).not.toHaveBeenCalled();
  });

  it("envia o primeiro ponto na hora e depois a cada 25s", () => {
    renderHook(() => useLocationSharing(true));
    act(() => gps.move(-19.92, -43.94));
    expect(shareLocation).toHaveBeenCalledTimes(1);

    act(() => gps.move(-19.93, -43.94)); // GPS mexeu, mas o envio espera o intervalo
    expect(shareLocation).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(25_000));
    expect(shareLocation).toHaveBeenCalledTimes(2);
    expect(shareLocation).toHaveBeenLastCalledWith(-19.93, -43.94);
  });

  it("permissão negada: avisa", () => {
    const { result } = renderHook(() => useLocationSharing(true));
    act(() => gps.deny());
    expect(result.current.permissionDenied).toBe(true);
  });

  it("ao terminar as entregas: desliga o GPS, para de enviar e limpa o aviso", () => {
    const { result, rerender } = renderHook(({ active }) => useLocationSharing(active), {
      initialProps: { active: true },
    });
    act(() => gps.deny());
    rerender({ active: false });

    expect(gps.active()).toBe(0);
    expect(result.current.permissionDenied).toBe(false);
    act(() => vi.advanceTimersByTime(60_000));
    expect(shareLocation).not.toHaveBeenCalled();
  });

  it("nova entrega depois de uma negação começa sem o aviso antigo", () => {
    const { result, rerender } = renderHook(({ active }) => useLocationSharing(active), {
      initialProps: { active: true },
    });
    act(() => gps.deny());
    rerender({ active: false });
    rerender({ active: true });
    expect(result.current.permissionDenied).toBe(false);
  });
});
