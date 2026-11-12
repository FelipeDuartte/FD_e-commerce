// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { orderBreakdown } from "../confirmUtils";

vi.mock("../../../shared/utils/Cloudnary", () => ({ imgProduto: (x) => x }));
const { default: OrderItemsCard } = await import("./OrderItemsCard");

const COCA = { nome: "Coca-Cola 2L", preco: 10.9, quantity: 1 };
afterEach(cleanup);

// Valor da linha (rótulo → valor ao lado)
const row = (label) => screen.getByText(label).nextElementSibling?.textContent;

describe("orderBreakdown", () => {
  it("separa produtos e frete", () => {
    expect(orderBreakdown([COCA], 15.9, 5)).toEqual({ subtotal: 10.9, deliveryFee: 5, cardFee: 0, otherFees: 0 });
  });
  it("o que sobra além do frete é taxa do cartão", () => {
    expect(orderBreakdown([COCA], 16.42, 5).cardFee).toBe(0.52);
  });
  it("pedido antigo salvo sem o frete: diferença vira 'entrega e taxas'", () => {
    expect(orderBreakdown([COCA], 15.9, undefined)).toMatchObject({ deliveryFee: null, otherFees: 5 });
  });
  it("sem frete nem taxa", () => {
    expect(orderBreakdown([COCA], 10.9, 0)).toMatchObject({ deliveryFee: 0, cardFee: 0, otherFees: 0 });
  });
});

describe("OrderItemsCard", () => {
  it("mostra subtotal + entrega, que somam o total (R$ 10,90 + R$ 5,00 = R$ 15,90)", () => {
    render(<OrderItemsCard cartItems={[COCA]} total={15.9} deliveryFee={5} />);
    expect(row("Subtotal")).toBe("R$ 10,90");
    expect(row("Entrega")).toBe("R$ 5,00");
    expect(row("Total pago")).toBe("R$ 15,90");
  });

  it("frete grátis aparece como 'Grátis'", () => {
    render(<OrderItemsCard cartItems={[COCA]} total={10.9} deliveryFee={0} />);
    expect(row("Entrega")).toBe("Grátis");
  });

  it("crédito: mostra a taxa do cartão", () => {
    render(<OrderItemsCard cartItems={[COCA]} total={16.42} deliveryFee={5} />);
    expect(row("Taxa do cartão")).toBe("R$ 0,52");
  });

  it("retirada sem taxa: só o total (nada de linha de entrega)", () => {
    render(<OrderItemsCard cartItems={[COCA]} total={10.9} deliveryFee={0} isRetirada />);
    expect(screen.queryByText("Entrega")).toBeNull();
    expect(screen.queryByText("Subtotal")).toBeNull();
  });

  it("pedido antigo salvo sem o frete: mostra a diferença", () => {
    render(<OrderItemsCard cartItems={[COCA]} total={15.9} />);
    expect(row("Entrega e taxas")).toBe("R$ 5,00");
  });
});
