// Testa a lógica de fulfillOrder sem banco real: um "Supabase de mentira"
// (createFakeSupabase) simula só a fatia da API que a função usa
// (from().select().eq().in()/.maybeSingle()/.single(), .insert(), .rpc()),
// devolvendo dados fixos combinados por cenário. Roda sob Vitest/Node —
// fulfillOrder não usa nenhuma API do Deno, só recebe o cliente por
// parâmetro, então isso é seguro (ver plano de testes).

import { describe, expect, it } from "vitest";
import { fulfillOrder, FulfillmentError } from "./orderFulfillment.ts";

// Constrói um "table builder" encadeável (.select/.eq/.in/.insert) que
// também é "thenable" — awaitar ele direto, sem chamar .single()/
// .maybeSingle(), resolve pro `result` passado, igual ao supabase-js real.
function createTable(table, result, inserted) {
  const builder = {
    select() { return builder; },
    eq() { return builder; },
    in() { return builder; },
    insert(payload) {
      inserted[table] = inserted[table] ?? [];
      inserted[table].push(payload);
      return builder;
    },
    maybeSingle() { return Promise.resolve(result); },
    single() { return Promise.resolve(result); },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
  };
  return builder;
}

function createFakeSupabase(responses = {}) {
  const inserted = {};
  const rpcCalls = [];
  const defaults = {
    pdv_customers: { data: null, error: null },
    products: { data: [], error: null },
    store_config: { data: null, error: null },
    orders: { data: { id: "order-1", order_number: 1 }, error: null },
    order_payments: { error: null },
    order_items: { error: null },
    rpc: { data: { success: true }, error: null },
  };
  const merged = { ...defaults, ...responses };

  return {
    from(table) {
      return createTable(table, merged[table], inserted);
    },
    rpc(name, params) {
      rpcCalls.push({ name, params });
      return Promise.resolve(merged.rpc);
    },
    inserted,
    rpcCalls,
  };
}

const FEE_RATE = { 1: 0.0326, 4: 0.0736 };

function baseParams(overrides = {}) {
  return {
    storeId: "store-1",
    userId: null,
    cartItems: [{ id: "p1", name: "Produto 1", quantity: 1 }],
    paymentMethod: "cash",
    installments: null,
    deliveryFee: 0,
    address: {},
    channel: "online",
    status: "pago",
    applyCardFee: false,
    ...overrides,
  };
}

const product = (overrides = {}) => ({
  id: "p1", price: 100, old_price: null, promotion: false, is_active: true, stock: 100,
  ...overrides,
});

describe("fulfillOrder", () => {
  it("crédito online sempre salva 1x, mesmo se o client mandar outro valor, e usa a taxa de 1x", async () => {
    const fake = createFakeSupabase({
      products: { data: [product()], error: null },
      store_config: { data: { credit_installment_fee_rate: FEE_RATE }, error: null },
    });
    const result = await fulfillOrder(fake, baseParams({
      paymentMethod: "credit_card",
      installments: 6, // client tentando mandar 6x — deve ser ignorado
      channel: "online",
      applyCardFee: true,
    }));

    const insertedOrder = fake.inserted.orders[0];
    expect(insertedOrder.installments).toBe(1);
    expect(insertedOrder.card_fee_amount).toBeCloseTo(3.26, 2);
    expect(result.total).toBeCloseTo(103.26, 2);
  });

  it("crédito balcão com parcelas válidas salva o número real e usa a taxa correspondente", async () => {
    const fake = createFakeSupabase({
      products: { data: [product()], error: null },
      store_config: { data: { credit_installment_fee_rate: FEE_RATE }, error: null },
    });
    const result = await fulfillOrder(fake, baseParams({
      paymentMethod: "credit_card",
      installments: 4,
      channel: "balcao",
      applyCardFee: true,
    }));

    const insertedOrder = fake.inserted.orders[0];
    expect(insertedOrder.installments).toBe(4);
    expect(insertedOrder.card_fee_amount).toBeCloseTo(7.36, 2);
    expect(result.total).toBeCloseTo(107.36, 2);
  });

  it("crédito balcão com parcelas inválidas cai pro default de 1x", async () => {
    for (const invalidInstallments of [0, 15]) {
      const fake = createFakeSupabase({
        products: { data: [product()], error: null },
        store_config: { data: { credit_installment_fee_rate: FEE_RATE }, error: null },
      });
      await fulfillOrder(fake, baseParams({
        paymentMethod: "credit_card",
        installments: invalidInstallments,
        channel: "balcao",
        applyCardFee: true,
      }));
      expect(fake.inserted.orders[0].installments).toBe(1);
    }
  });

  it("venda de balcão de produto em promoção cobra o preço de tabela (old_price), não o promocional", async () => {
    const fake = createFakeSupabase({
      products: { data: [product({ price: 80, old_price: 100, promotion: true })], error: null },
    });
    const result = await fulfillOrder(fake, baseParams({ channel: "balcao" }));
    expect(result.total).toBeCloseTo(100, 2);
  });

  it("venda online do mesmo produto em promoção cobra o preço promocional normalmente", async () => {
    const fake = createFakeSupabase({
      products: { data: [product({ price: 80, old_price: 100, promotion: true })], error: null },
    });
    const result = await fulfillOrder(fake, baseParams({ channel: "online" }));
    expect(result.total).toBeCloseTo(80, 2);
  });

  it("desconto maior que o subtotal é limitado ao próprio subtotal (nunca fica negativo)", async () => {
    const fake = createFakeSupabase({
      products: { data: [product({ price: 50 })], error: null },
    });
    const result = await fulfillOrder(fake, baseParams({ discountAmount: 999 }));
    const insertedOrder = fake.inserted.orders[0];
    expect(insertedOrder.discount_amount).toBe(50);
    expect(result.total).toBe(0);
  });

  it("pagamento dividido cuja soma não bate com o total calculado é rejeitado", async () => {
    const fake = createFakeSupabase({
      products: { data: [product({ price: 100 })], error: null },
    });
    await expect(
      fulfillOrder(fake, baseParams({
        channel: "balcao",
        paymentMethod: undefined,
        payments: [{ method: "cash", amount: 40 }, { method: "pix", amount: 40 }],
      })),
    ).rejects.toThrow(FulfillmentError);
  });

  it("carrinho vazio lança erro antes de qualquer consulta ao banco", async () => {
    const fake = createFakeSupabase();
    await expect(
      fulfillOrder(fake, baseParams({ cartItems: [] })),
    ).rejects.toThrow("Carrinho vazio.");
  });
});
