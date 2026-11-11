import { describe, expect, it } from "vitest";
import { validateCheckoutForm, validateOrder } from "./checkoutValidation";

const ADDRESS = {
  name: "Maria",
  phone: "(31) 99999-1234",
  street: "Rua A",
  number: "10",
  district: "Centro",
  complement: "",
  city: "BH",
  state: "MG",
};

// Formulário válido de entrega; cada teste muda só o que interessa
const form = ({ address, ...rest } = {}) => ({
  address: { ...ADDRESS, ...address },
  cep: "30110-000",
  cepError: "",
  isRetirada: false,
  ...rest,
});

describe("validateCheckoutForm", () => {
  it("formulário completo passa", () => {
    expect(validateCheckoutForm(form())).toBeNull();
  });

  it.each([
    ["nome vazio", { address: { name: "  " } }, "Por favor, informe seu nome."],
    ["telefone sem DDD", { address: { phone: "99999-1234" } }, "Por favor, informe um telefone válido com DDD."],
    ["CEP incompleto", { cep: "30110" }, "Por favor, informe um CEP válido."],
    ["CEP não encontrado", { cepError: "CEP não encontrado" }, "Por favor, verifique o CEP informado."],
    ["sem rua", { address: { street: "" } }, "Por favor, informe o endereço."],
    ["sem número", { address: { number: " " } }, "Por favor, informe o número."],
    ["sem bairro", { address: { district: "" } }, "Por favor, informe o bairro."],
  ])("%s", (_, overrides, message) => {
    expect(validateCheckoutForm(form(overrides))).toBe(message);
  });

  it("telefone fixo com DDD (10 dígitos) vale", () => {
    expect(validateCheckoutForm(form({ address: { phone: "(31) 3451-0200" } }))).toBeNull();
  });

  it("retirada na loja só exige nome e telefone", () => {
    const retirada = form({ isRetirada: true, cep: "", address: { street: "", number: "", district: "" } });
    expect(validateCheckoutForm(retirada)).toBeNull();
  });
});

describe("validateOrder", () => {
  const order = (overrides = {}) => ({
    paymentMethod: "pix",
    cartItems: [{ id: 1, quantity: 1 }],
    address: { street: "Rua A", number: "10", district: "Centro", cep: "30110000" },
    ...overrides,
  });

  it("pedido de entrega completo passa", () => {
    expect(validateOrder(order())).toBeNull();
  });

  it("carrinho vazio", () => {
    expect(validateOrder(order({ cartItems: [] }))).toBe("Carrinho vazio.");
  });

  it("sem forma de pagamento", () => {
    expect(validateOrder(order({ paymentMethod: "" }))).toBe("Forma de pagamento não selecionada.");
  });

  it("entrega sem CEP", () => {
    expect(validateOrder(order({ address: { street: "Rua A", number: "10", district: "Centro" } })))
      .toBe("Endereço incompleto. Informe o CEP.");
  });

  it("retirada exige nome e telefone, não endereço", () => {
    expect(validateOrder(order({ address: { isRetirada: true, name: "Maria", phone: "31999991234" } }))).toBeNull();
    expect(validateOrder(order({ address: { isRetirada: true, name: "Maria" } })))
      .toBe("Informe seu telefone para contato.");
  });
});
