// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { receiptTotals } from "../receiptTotals";

vi.mock("../../../../shared/supabase/Supabaseclient", () => ({
  getCurrentStore: () => ({ name: "Dudu Bebidas", pickup_address: "Rua X, 1", phone: "(31) 3451-0200", logo_url: null }),
}));
const { default: OrderReceipt } = await import("./OrderReceipt");

afterEach(cleanup);

const ORDER = {
  id: "o1",
  order_number: 128,
  created_at: "2026-11-24T18:30:00Z",
  total: 27.4,
  discount_amount: 0,
  card_fee_amount: 0,
  payment_method: "cash",
  payment_status: "aguardando_pagamento",
  installments: null,
  address: { name: "Maria", phone: "(31) 99999-1234", street: "Rua A", number: "10", district: "Centro" },
  order_items: [
    { id: "i1", name: "Heineken Lata", price: 5.6, quantity: 2 },
    { id: "i2", name: "Coca-Cola 2L", price: 11.2, quantity: 1 },
  ],
};
const text = () => document.body.textContent.replace(/\u00a0/g, " ");

describe("receiptTotals", () => {
  it("frete = o que sobra do total depois dos itens", () => {
    expect(receiptTotals(ORDER)).toEqual({ itemsTotal: 22.4, discount: 0, cardFee: 0, delivery: 5 });
  });
  it("cartão online: taxa à parte, não vira frete", () => {
    const o = { ...ORDER, total: 23.13, card_fee_amount: 0.73, address: { ...ORDER.address } };
    expect(receiptTotals(o)).toMatchObject({ cardFee: 0.73, delivery: 0 });
  });
});

describe("OrderReceipt", () => {
  it("entrega: loja, pedido, endereço, itens, frete e 'cobrar na entrega'", () => {
    render(<OrderReceipt order={ORDER} />);
    const t = text();
    expect(t).toContain("Dudu Bebidas");
    expect(t).toContain("Pedido #128 · Site");
    expect(t).toContain("ENTREGAR EM:");
    expect(t).toContain("Rua A, 10");
    expect(t).toContain("Heineken Lata x2");
    expect(t).toContain("R$ 11,20");
    expect(t).toContain("Entrega");
    expect(t).toContain("R$ 27,40");
    expect(t).toContain("Pagamento: Dinheiro");
    expect(t).toContain("COBRAR NA ENTREGA");
  });

  it("pago online: mostra PAGO e as parcelas", () => {
    render(<OrderReceipt order={{ ...ORDER, payment_method: "online_card", payment_status: "pago", installments: 3 }} />);
    expect(text()).toContain("Cartão online em 3x");
    expect(text()).toContain("PAGO");
    expect(text()).not.toContain("COBRAR");
  });

  it("retirada: sem endereço, 'cobrar na retirada'", () => {
    render(<OrderReceipt order={{ ...ORDER, total: 22.4, address: { isRetirada: true, name: "Maria", phone: "31999991234" } }} />);
    expect(text()).toContain("RETIRADA NA LOJA");
    expect(text()).toContain("COBRAR NA RETIRADA");
    expect(text()).not.toContain("ENTREGAR EM");
    expect(text()).not.toContain("Entrega");
  });

  it("sem pedido: nada", () => {
    const { container } = render(<OrderReceipt order={null} />);
    expect(container.innerHTML).toBe("");
  });
});
