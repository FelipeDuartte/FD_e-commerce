import { beforeEach, describe, expect, it, vi } from "vitest";

// A loja atual vem do cliente do Supabase — substituído por uma loja de
// mentira pra não precisar de banco nem de variáveis de ambiente.
const mock = vi.hoisted(() => ({ store: null }));
vi.mock("../supabase/Supabaseclient", () => ({ getCurrentStore: () => mock.store }));

const { formatWhatsapp, instagramLink, pickupAddress, whatsappLink } = await import("./storeContact");

beforeEach(() => {
  mock.store = {
    whatsapp: "(31) 8307-7990",
    instagram: "@dudubebidas",
    pickup_address: "Rua das Flores, 100",
    pickup_address_detail: "Centro",
  };
});

describe("whatsappLink", () => {
  it("usa o WhatsApp da loja e põe o 55", () => {
    expect(whatsappLink()).toBe("https://wa.me/553183077990");
  });
  it("não duplica o 55", () => {
    expect(whatsappLink("5531983077990")).toBe("https://wa.me/5531983077990");
  });
  it("null quando a loja não tem WhatsApp", () => {
    mock.store = {};
    expect(whatsappLink()).toBeNull();
  });
});

describe("formatWhatsapp", () => {
  it("fixo e celular", () => {
    expect(formatWhatsapp("553183077990")).toBe("+55 (31) 8307-7990");
    expect(formatWhatsapp("31999450717")).toBe("+55 (31) 99945-0717");
  });
});

describe("instagramLink", () => {
  it("tira o @ e monta o link", () => {
    expect(instagramLink()).toBe("https://www.instagram.com/dudubebidas/");
  });
  it("null quando vazio", () => {
    expect(instagramLink("  ")).toBeNull();
  });
});

describe("pickupAddress", () => {
  it("endereço de retirada da loja", () => {
    expect(pickupAddress()).toEqual({ street: "Rua das Flores, 100", detail: "Centro" });
  });
  it("null quando a loja não cadastrou", () => {
    mock.store = { pickup_address: null };
    expect(pickupAddress()).toBeNull();
  });
});
