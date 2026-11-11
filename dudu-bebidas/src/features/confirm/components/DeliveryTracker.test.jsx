// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mapa de verdade (Mapbox) não roda no navegador simulado — troca por um
// marcador simples que mostra os pinos recebidos.
vi.mock("../../../shared/components/DeliveryMap/DeliveryMap", () => ({
  default: ({ markers }) => <div data-testid="mapa">{markers.map((m) => m.label).join(",")}</div>,
}));
vi.mock("../../../shared/utils/storeContact", () => ({
  whatsappLink: () => "https://wa.me/553183077990",
}));

const { default: DeliveryTracker } = await import("./DeliveryTracker");

const AGORA = new Date(2026, 10, 9, 20, 0, 0);
const minutosAtras = (min) => new Date(AGORA.getTime() - min * 60_000).toISOString();

// Entregador saindo da Praça Sete, entrega na Savassi (BH)
const EM_ENTREGA = {
  status: "on_the_way",
  statusLoading: false,
  animating: false,
  courierName: "Carlos",
  courierLat: -19.9191,
  courierLng: -43.9386,
  deliveryLat: -19.9386,
  deliveryLng: -43.9345,
  courierLocationUpdatedAt: minutosAtras(0),
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("DeliveryTracker", () => {
  it("em entrega com localização recente: mapa, pinos e previsão de chegada", () => {
    render(<DeliveryTracker {...EM_ENTREGA} />);
    expect(screen.getByTestId("mapa").textContent).toBe("Entregador,Você");
    expect(screen.getByText(/Chegada estimada: ~5 min/)).toBeTruthy();
  });

  it("mostra o entregador e o contato da LOJA (não o celular dele)", () => {
    render(<DeliveryTracker {...EM_ENTREGA} />);
    expect(screen.getByText("Carlos")).toBeTruthy();
    expect(screen.getByText("Falar com a loja").getAttribute("href")).toBe("https://wa.me/553183077990");
  });

  it("localização atrasada (mais de 3 min): mantém o último ponto e avisa há quanto tempo", () => {
    render(<DeliveryTracker {...EM_ENTREGA} courierLocationUpdatedAt={minutosAtras(5)} />);
    expect(screen.getByTestId("mapa")).toBeTruthy();
    expect(screen.getByText(/Última posição do entregador há 5 min/)).toBeTruthy();
    expect(screen.queryByText(/Chegada estimada/)).toBeNull(); // previsão sem posição atual não vale
  });

  it("localização parada há muito tempo (mais de 20 min): troca o mapa pelo aviso", () => {
    render(<DeliveryTracker {...EM_ENTREGA} courierLocationUpdatedAt={minutosAtras(25)} />);
    expect(screen.queryByTestId("mapa")).toBeNull();
    expect(screen.getByText(/Não conseguimos confirmar a localização do entregador/)).toBeTruthy();
  });

  it("o aviso aparece sozinho com o passar do tempo, sem nova resposta do servidor", () => {
    render(<DeliveryTracker {...EM_ENTREGA} courierLocationUpdatedAt={minutosAtras(2)} />);
    expect(screen.queryByText(/Última posição/)).toBeNull();

    // 2 minutos depois (o relógio interno atualiza a cada 10s)
    act(() => vi.advanceTimersByTime(2 * 60_000));
    expect(screen.getByText(/Última posição do entregador há 4 min/)).toBeTruthy();
  });

  it("saiu pra entrega mas o primeiro ponto ainda não chegou", () => {
    render(<DeliveryTracker {...EM_ENTREGA} courierLat={null} courierLng={null} courierLocationUpdatedAt={null} />);
    expect(screen.getByText(/Carregando localização do entregador/)).toBeTruthy();
  });

  it.each(["pending", "preparing"])("pedido %s ainda não mostra mapa, só o aviso de rastreio", (status) => {
    render(<DeliveryTracker {...EM_ENTREGA} status={status} />);
    expect(screen.queryByTestId("mapa")).toBeNull();
    expect(screen.getByText(/Rastreamento ao vivo liberado/)).toBeTruthy();
  });

  it("carregando o status", () => {
    render(<DeliveryTracker {...EM_ENTREGA} statusLoading />);
    expect(screen.getByText("Carregando status...")).toBeTruthy();
  });
});
