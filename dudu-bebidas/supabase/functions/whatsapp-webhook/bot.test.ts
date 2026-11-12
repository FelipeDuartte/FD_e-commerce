// Testa a lógica do chatbot (bot.ts) com uma loja de mentira — sem banco
// nem Meta. Roda sob Vitest/Node (bot.ts não usa API do Deno).

import { describe, expect, it } from "vitest";
import {
  type BotData,
  type BotProduct,
  buildReply,
  detectIntent,
  menuRows,
  openNowMessage,
  phoneKey,
  searchProducts,
} from "./bot.ts";

const PRODUCTS: BotProduct[] = [
  { name: "HEINEKEN LATA 350ML", price: 5.5, old_price: null, promotion: false, stock: 120 },
  { name: "HEINEKEN LONG NECK 330ML", price: 7, old_price: null, promotion: false, stock: 0 },
  { name: "COCA-COLA 2L", price: 10.9, old_price: 12, promotion: true, stock: 30 },
  { name: "ENERGÉTICO PARATUDO 2L", price: 9, old_price: null, promotion: false, stock: 5 },
  { name: "BRAHMA LATA 350ML", price: 4, old_price: null, promotion: false, stock: 50, category: "cerveja" },
];

// Segunda a sábado 09:00–19:00, domingo fechado
const HOURS = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
  day_of_week: d,
  is_open: d !== 0,
  open_time: "09:00:00",
  close_time: "19:00:00",
}));

const CONFIG = {
  close_on_holidays: true,
  free_shipping_threshold: 150,
  payment_methods_enabled: { cash: true, credit_card: true, debit_card: false },
  online_payment: true,
};

function fakeData(overrides: Partial<BotData> = {}): BotData {
  return {
    store: {
      name: "Loja Teste",
      whatsapp: "(31) 8307-7990",
      pickupAddress: "Rua de Teste, 100",
      pickupAddressDetail: "Centro, Cidade - MG",
      siteUrl: "https://loja.teste",
    },
    hours: async () => HOURS,
    config: async () => CONFIG,
    zones: async () => [
      { nome: "Retirada na Loja", frete: 0, is_retirada: true },
      { nome: "Centro", frete: 5, is_retirada: false },
      { nome: "Bairro Longe", frete: 8.5, is_retirada: false },
    ],
    products: async () => PRODUCTS,
    recentOrders: async () => [],
    ...overrides,
  };
}

// Horários em Brasília (UTC-3)
const QUARTA_10H = new Date("2026-11-04T13:00:00Z");
const QUARTA_20H = new Date("2026-11-04T23:00:00Z");
const DOMINGO = new Date("2026-11-08T15:00:00Z");

describe("horário", () => {
  it("aberto durante o expediente (horário de Brasília, não UTC)", () => {
    expect(openNowMessage(HOURS, CONFIG, QUARTA_10H)).toContain("abertos");
  });
  it("fechado depois do expediente", () => {
    expect(openNowMessage(HOURS, CONFIG, QUARTA_20H)).toContain("fechamos");
  });
  it("fechado no domingo", () => {
    expect(openNowMessage(HOURS, CONFIG, DOMINGO)).toContain("fechados");
  });
  it("fechado em feriado quando a loja fecha em feriado", () => {
    const natal = new Date("2026-12-25T15:00:00Z"); // sexta, 12h em Brasília
    expect(openNowMessage(HOURS, CONFIG, natal)).toContain("feriado");
    expect(openNowMessage(HOURS, { ...CONFIG, close_on_holidays: false }, natal)).toContain("abertos");
  });
});

describe("intenção do texto", () => {
  it.each([
    ["oi", "menu"],
    ["Boa noite!", "menu"],
    ["ola, bom dia", "menu"],
    ["oi tudo bem?", "menu"],
    ["obrigado", "thanks"],
    ["vocês abrem que horas?", "horario"],
    ["entregam no centro?", "entrega"],
    ["aceita pix?", "pagamento"],
    ["cadê meu pedido", "pedido"],
    ["onde fica a loja", "endereco"],
    ["quero falar com atendente", "atendente"],
    ["tem heineken?", null],
    ["vcs tao abertos hj?", "horario"],
    ["qual orario de vcs", "horario"],
    ["vcs vendem carvão?", null],
    ["quero fazer um pedido", "site"],
    ["tem promoção?", "promocao"],
    ["ok", "thanks"],
    ["tchau", "thanks"],
  ])("%s → %s", (text, intent) => {
    expect(detectIntent(text)).toBe(intent);
  });
});

describe("busca de produto", () => {
  it("acha ignorando palavras da pergunta e acentos", () => {
    const found = searchProducts(PRODUCTS, "tem heineken gelada?");
    expect(found.map((p) => p.name)).toEqual(["HEINEKEN LATA 350ML", "HEINEKEN LONG NECK 330ML"]);
  });
  it("ignora 'quero saber se tem'", () => {
    expect(searchProducts(PRODUCTS, "quero saber se tem heineken")).toHaveLength(2);
  });
  it("disponível vem antes do que está em falta", () => {
    expect(searchProducts(PRODUCTS, "heineken")[0].stock).toBeGreaterThan(0);
  });
  it("'para tudo' acha 'PARATUDO'", () => {
    expect(searchProducts(PRODUCTS, "energetico paratudo")).toHaveLength(1);
  });
  it("aceita apelido e erro de digitação", () => {
    expect(searchProducts(PRODUCTS, "heinekem lata").map((p) => p.name)).toEqual(["HEINEKEN LATA 350ML"]);
    expect(searchProducts(PRODUCTS, "tem breja?").map((p) => p.name)).toContain("BRAHMA LATA 350ML");
  });
  it("busca pela categoria no plural", () => {
    expect(searchProducts(PRODUCTS, "quais cervejas voces tem")).toHaveLength(1);
  });
  it("ignora quantidade e 'vou querer'", () => {
    expect(searchProducts(PRODUCTS, "vou querer 5 heinekens lata")).toHaveLength(1);
  });
  it("nada encontrado", () => {
    expect(searchProducts(PRODUCTS, "vinho tinto")).toEqual([]);
  });
});

describe("telefone", () => {
  it("compara com e sem o 9º dígito e com ou sem 55", () => {
    expect(phoneKey("553183077990")).toBe(phoneKey("(31) 98307-7990"));
    expect(phoneKey("5531983077990")).toBe(phoneKey("31 8307-7990"));
    expect(phoneKey("123")).toBeNull();
  });
});

describe("respostas", () => {
  it("saudação manda o menu com as opções da loja", async () => {
    const reply = await buildReply({ kind: "text", text: "oi" }, fakeData(), "553199999999");
    expect(reply.type).toBe("list");
    if (reply.type === "list") expect(reply.rows.map((r) => r.id)).toContain("atendente");
  });

  it("loja sem site/atendente/endereço não mostra essas opções", () => {
    const ids = menuRows({ name: "X", whatsapp: null, pickupAddress: null, pickupAddressDetail: null, siteUrl: null })
      .map((r) => r.id);
    expect(ids).not.toContain("site");
    expect(ids).not.toContain("atendente");
    expect(ids).not.toContain("endereco");
  });

  it("títulos do menu cabem no limite da Meta (24)", () => {
    for (const row of menuRows(fakeData().store)) expect([...row.title].length).toBeLessThanOrEqual(24);
  });

  it("entrega lista bairros, retirada e frete grátis", async () => {
    const reply = await buildReply({ kind: "choice", id: "entrega" }, fakeData(), "553199999999");
    expect(reply.type).toBe("buttons");
    expect(reply.body).toContain("Centro: R$");
    expect(reply.body).toContain("Retirada na loja");
    expect(reply.body).toContain("acima de R$");
    expect(reply.body).not.toContain("Retirada na Loja:"); // retirada não aparece como bairro
  });

  it("pagamento mostra só as formas ligadas", async () => {
    const reply = await buildReply({ kind: "choice", id: "pagamento" }, fakeData(), "553199999999");
    expect(reply.body).toContain("Pix ou cartão em até 12x (pelo site)");
    expect(reply.body).toContain("Dinheiro na entrega");
    expect(reply.body).not.toContain("débito");
  });

  it("loja sem pagamento online: não oferece Pix pelo site", async () => {
    const reply = await buildReply(
      { kind: "choice", id: "pagamento" },
      fakeData({ config: async () => ({ ...CONFIG, online_payment: false }) }),
      "553199999999",
    );
    expect(reply.body).not.toContain("Pix ou cartão");
  });

  it("pagamento online desligado pela loja: não oferece", async () => {
    const reply = await buildReply(
      { kind: "choice", id: "pagamento" },
      fakeData({ config: async () => ({ ...CONFIG, payment_methods_enabled: { ...CONFIG.payment_methods_enabled, infinitepay: false } }) }),
      "553199999999",
    );
    expect(reply.body).not.toContain("Pix ou cartão");
  });

  it("produto encontrado mostra preço, promoção e link do site", async () => {
    const reply = await buildReply({ kind: "text", text: "coca 2l" }, fakeData(), "553199999999");
    expect(reply.body.replace(/\u00a0/g, " ")).toContain("R$ 10,90 (de R$ 12,00)");
    expect(reply.body).toContain("https://loja.teste");
  });

  it("produto não encontrado volta para o menu avisando", async () => {
    const reply = await buildReply({ kind: "text", text: "vinho tinto" }, fakeData(), "553199999999");
    expect(reply.type).toBe("list");
    expect(reply.body).toContain('"vinho tinto"');
  });

  it("meu pedido acha o pedido pelo telefone mesmo sem o 9º dígito", async () => {
    const data = fakeData({
      recentOrders: async () => [
        { order_number: 10, status: "delivered", total: 30, created_at: "2026-11-04T12:00:00Z", address: { phone: "(31) 98888-1111" } },
        { order_number: 11, status: "on_the_way", total: 45, created_at: "2026-11-04T12:30:00Z", address: { phone: "31 98888-1111" } },
        { order_number: 12, status: "pending", total: 99, created_at: "2026-11-04T12:40:00Z", address: { phone: "(31) 97777-2222" } },
      ],
    });
    const reply = await buildReply({ kind: "choice", id: "pedido" }, data, "553188881111", QUARTA_10H);
    expect(reply.body).toContain("#11");
    expect(reply.body).toContain("Saiu para entrega");
    expect(reply.body).toContain("hoje");
  });

  it("sem pedido recente oferece o atendente", async () => {
    const reply = await buildReply({ kind: "choice", id: "pedido" }, fakeData(), "553188881111");
    expect(reply.body).toContain("wa.me/553183077990");
  });

  it("bairro específico responde o frete dele", async () => {
    const reply = await buildReply({ kind: "text", text: "entregam no bairro longe?" }, fakeData(), "553199999999");
    expect(reply.body).toContain("Sim! Entregamos em *Bairro Longe*");
  });

  it("bairro fora da lista avisa e mostra os atendidos", async () => {
    const reply = await buildReply({ kind: "text", text: "entrega no jardim europa?" }, fakeData(), "553199999999");
    expect(reply.body).toContain("Não encontrei *jardim europa*");
    expect(reply.body).toContain("Centro: R$");
  });

  it("duas dúvidas na mesma mensagem", async () => {
    const reply = await buildReply({ kind: "text", text: "aceita pix e entrega no centro?" }, fakeData(), "553199999999");
    expect(reply.body).toContain("Entregamos em *Centro*");
    expect(reply.body).toContain("Formas de pagamento");
  });

  it("produto junto com a dúvida", async () => {
    const reply = await buildReply({ kind: "text", text: "tem coca 2 litros pra entregar?" }, fakeData(), "553199999999");
    expect(reply.body).toContain("COCA-COLA 2L");
    expect(reply.body).not.toContain("Não encontrei *entregar*");
  });

  it("dia específico do horário", async () => {
    const reply = await buildReply({ kind: "text", text: "abre domingo?" }, fakeData(), "553199999999", QUARTA_10H);
    expect(reply.body).toContain("📅 *Domingo*: fechado");
  });

  it("promoções listam só o que está em oferta", async () => {
    const reply = await buildReply({ kind: "text", text: "tem promoção?" }, fakeData(), "553199999999");
    expect(reply.body).toContain("COCA-COLA 2L");
    expect(reply.body).not.toContain("HEINEKEN");
  });

  it("número escolhe a opção do menu", async () => {
    const reply = await buildReply({ kind: "text", text: "1" }, fakeData(), "553199999999", QUARTA_10H);
    expect(reply.body).toContain("Horário de funcionamento");
  });

  it("emoji de joinha responde curto", async () => {
    expect((await buildReply({ kind: "text", text: "👍" }, fakeData(), "553199999999")).type).toBe("text");
  });

  it("áudio avisa que não ouve áudio", async () => {
    const reply = await buildReply({ kind: "other", media: "audio" }, fakeData(), "553199999999");
    expect(reply.body).toContain("áudios");
  });

  it("link do site no final, uma vez só", async () => {
    const reply = await buildReply({ kind: "text", text: "aceita pix e entrega no centro?" }, fakeData(), "553199999999");
    expect(reply.body.trimEnd().endsWith("https://loja.teste")).toBe(true);
    expect(reply.body.split("https://loja.teste")).toHaveLength(2);
  });

  it("sem link em agradecimento e atendente", async () => {
    for (const text of ["obrigado", "quero falar com atendente"]) {
      expect((await buildReply({ kind: "text", text }, fakeData(), "553199999999")).body).not.toContain("loja.teste");
    }
  });

  it("áudio/foto recebe o menu", async () => {
    expect((await buildReply({ kind: "other" }, fakeData(), "553199999999")).type).toBe("list");
  });
});
