import { describe, expect, it } from "vitest";
import { buildPixBrCode, crc16, normalizePixPhoneKey } from "./pixBrCode.ts";

/** Lê o BR Code (ID de 2 dígitos + tamanho de 2 dígitos + valor). */
function parseTlv(payload: string): Record<string, string> {
  const fields: Record<string, string> = {};
  let i = 0;
  while (i < payload.length) {
    const id = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    fields[id] = payload.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return fields;
}

const PARAMS = {
  pixKey: "+5531999998888",
  merchantName: "Dudu Bebidas",
  merchantCity: "Belo Horizonte",
  amount: 45.9,
  txid: "pedido-1234",
};

describe("crc16", () => {
  it("bate com o valor de referência do CRC16/CCITT-FALSE", () => {
    // Vetor de teste padrão do algoritmo: "123456789" → 29B1
    expect(crc16("123456789")).toBe("29B1");
  });
});

describe("buildPixBrCode", () => {
  const code = buildPixBrCode(PARAMS);
  const fields = parseTlv(code);

  it("tem a chave Pix da loja no campo do Pix", () => {
    expect(parseTlv(fields["26"])).toEqual({ "00": "br.gov.bcb.pix", "01": "+5531999998888" });
  });

  it("valor exato com 2 casas e moeda real", () => {
    expect(fields["54"]).toBe("45.90");
    expect(fields["53"]).toBe("986");
    expect(fields["58"]).toBe("BR");
  });

  it("nome e cidade sem acento e em maiúsculas, dentro do limite", () => {
    const c = parseTlv(buildPixBrCode({ ...PARAMS, merchantName: "Mercearia São José da Esquina Grande", merchantCity: "São João del-Rei" }));
    expect(c["59"]).toBe("MERCEARIA SAO JOSE DA ESQ"); // 25 caracteres
    expect(c["60"]).toBe("SAO JOAO DELREI");
  });

  it("referência do pedido só com letras e números", () => {
    expect(parseTlv(fields["62"])).toEqual({ "05": "pedido1234" });
  });

  it("termina com o CRC correto do restante do código", () => {
    expect(code.slice(-8, -4)).toBe("6304");
    expect(code.slice(-4)).toBe(crc16(code.slice(0, -4)));
  });

  it("valor quebrado é arredondado em centavos", () => {
    expect(parseTlv(buildPixBrCode({ ...PARAMS, amount: 0.1 + 0.2 }))["54"]).toBe("0.30");
  });
});

describe("normalizePixPhoneKey", () => {
  it.each([
    ["(31) 99999-8888", "+5531999998888"],
    ["31999998888", "+5531999998888"],
    ["+55 31 99999-8888", "+5531999998888"],
    ["3134510200", "+553134510200"],
    ["email@loja.com", "email@loja.com"],
    ["123", "123"],
  ])("%s → %s", (raw, expected) => {
    expect(normalizePixPhoneKey(raw)).toBe(expected);
  });
});
