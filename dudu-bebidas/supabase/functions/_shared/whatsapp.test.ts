import { describe, expect, it } from "vitest";
import { buildTemplatePayload, isParameterMismatch } from "./whatsapp.ts";

describe("buildTemplatePayload", () => {
  it("corpo com variáveis nomeadas", () => {
    const p = buildTemplatePayload("5531999990000", "pedido_aceito", { customer_name: "Maria", order_id: "128" });
    expect(p.template.components).toEqual([
      {
        type: "body",
        parameters: [
          { type: "text", parameter_name: "customer_name", text: "Maria" },
          { type: "text", parameter_name: "order_id", text: "128" },
        ],
      },
    ]);
    expect(p.template.language).toEqual({ code: "pt_BR" });
  });

  it("botão 'Acompanhar pedido': o código do pedido vai no final do link (1º botão)", () => {
    const p = buildTemplatePayload("5531999990000", "pedido_saiu_entrega", { customer_name: "Maria", order_id: "128" }, {
      urlButtonParam: "8f3a2c1e-5b7d-4e91-a0c4-9d2e6f1b3a77",
    });
    expect(p.template.components?.[1]).toEqual({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: "8f3a2c1e-5b7d-4e91-a0c4-9d2e6f1b3a77" }],
    });
  });

  it("sem variáveis e sem botão: sem components", () => {
    expect(buildTemplatePayload("5531999990000", "hello_world", {}).template.components).toBeUndefined();
  });
});

describe("isParameterMismatch", () => {
  it.each([132000, 132012, 131008, 131009, 100])("erro %s da Meta = parâmetros não batem (reenvia sem o link)", (code) => {
    expect(isParameterMismatch({ error: { code } })).toBe(true);
  });
  it.each([131042, 131026, 190])("erro %s (pagamento, número, token) não reenvia", (code) => {
    expect(isParameterMismatch({ error: { code } })).toBe(false);
  });
  it("resposta sem erro", () => {
    expect(isParameterMismatch({})).toBe(false);
  });
});
