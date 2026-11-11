import { describe, expect, it } from "vitest";
import {
  catalogFilenameToName,
  findSimilarProducts,
  isSameNameIgnoringCase,
  normalizeProductName,
} from "./productNameMatch";

describe("normalizeProductName", () => {
  it.each([
    ["Skol  600 ml", "Skol 600ml"],
    ["SKOL 600 ML", "SKOL 600ML"],
    ["Vodka 1,5 litros", "Vodka 1.5L"],
    ["Gelo 5 KG", "Gelo 5kg"],
    ["Coca 2l", "Coca 2L"],
  ])("%s → %s", (name, expected) => {
    expect(normalizeProductName(name)).toBe(expected);
  });
});

describe("catalogFilenameToName", () => {
  it("nome do arquivo vira nome de produto", () => {
    expect(catalogFilenameToName("paratudo-900ml")).toBe("Paratudo 900ml");
    expect(catalogFilenameToName("heineken-lata-350ml")).toBe("Heineken lata 350ml");
  });
});

describe("isSameNameIgnoringCase", () => {
  it("ignora maiúscula, acento e unidade", () => {
    expect(isSameNameIgnoringCase("Guaraná 2 L", "GUARANA 2L")).toBe(true);
  });
  it("espaço diferente conta como nome diferente", () => {
    expect(isSameNameIgnoringCase("para tudo", "Paratudo")).toBe(false);
  });
});

describe("findSimilarProducts", () => {
  const PRODUCTS = [
    { id: 1, name: "HEINEKEN 600ML", ean: "7891234567890" },
    { id: 2, name: "Heineken 330ml" },
    { id: 3, name: "Brahma 600ml" },
    { id: 4, name: "Caixa Skol 600ml" },
  ];
  const names = (results) => results.map((r) => r.product.name);

  it("acha o mesmo produto escrito diferente", () => {
    const [first] = findSimilarProducts("heiniken 600 ml", "", PRODUCTS);
    expect(first.product.id).toBe(1);
    expect(first.nearDuplicate).toBe(true);
  });

  it("tamanho diferente não é duplicado", () => {
    const result = findSimilarProducts("Heineken 600ml", "", PRODUCTS).find((r) => r.product.id === 2);
    expect(result?.nearDuplicate ?? false).toBe(false);
  });

  it("outra marca não aparece só por ser 'caixa'/'600ml'", () => {
    expect(names(findSimilarProducts("Caixa Brahma 600ml", "", PRODUCTS))).not.toContain("Caixa Skol 600ml");
  });

  it("mesmo código de barras é duplicado mesmo com nome diferente", () => {
    const [first] = findSimilarProducts("Cerveja holandesa", "7891234567890", PRODUCTS);
    expect(first).toMatchObject({ sameEan: true, nearDuplicate: true });
  });

  it("ignora o próprio produto ao editar", () => {
    expect(names(findSimilarProducts("HEINEKEN 600ML", "", PRODUCTS, { excludeId: 1 }))).not.toContain("HEINEKEN 600ML");
  });

  it("texto curto demais não busca", () => {
    expect(findSimilarProducts("he", "", PRODUCTS)).toEqual([]);
  });
});
