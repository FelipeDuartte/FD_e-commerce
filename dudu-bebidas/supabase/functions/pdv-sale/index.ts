// ─────────────────────────────────────────────────────────────
// Edge Function: pdv-sale
//
// Registra uma venda de balcão (PDV) feita por um admin da loja.
// Diferente de create-order: não existe caminho anônimo aqui —
// exige que quem chamou seja admin da própria loja (requireStoreAdmin).
// Reaproveita a mesma lógica de recálculo de preço/baixa de estoque
// via _shared/orderFulfillment.ts (mesmo caminho do checkout online).
//
// Body esperado:
//   { "cartItems": [{ "id": "...", "quantity": 2, "usePromoPrice": false }], "paymentMethod": "cash",
//     "cashSessionId": "uuid-do-caixa-aberto", "discountAmount": 5.00 }
// discountAmount é opcional, em R$, sobre o subtotal — desconto que o
// atendente decide dar (o site não tem isso hoje).
//
// Pagamento dividido: manda "payments": [{ "method": "cash", "amount": 20 },
// { "method": "credit_card", "amount": 30 }] em vez de "paymentMethod" —
// precisa somar exatamente o total do pedido (fulfillOrder valida).
//
// paymentMethod "credit_card" (forma única, não dividida) aceita
// "installments": 1 a 8 — cobra a taxa real da maquininha por fora do preço
// de tabela (ver INSTALLMENT_FEE_RATE em orderFulfillment.ts).
//
// "deferStockUntilPaid": true (só pedido fiado criado com produtos na aba
// Clientes) — não baixa estoque na hora, só quando o pagamento do cliente
// cobrir esse pedido (ver settle_fiado_stock). Omitido/false em todo o
// resto: venda de balcão baixa estoque no ato, como sempre.
//
// "address": { street, number, complement?, district, phone? } — só quando
// a venda é "Entrega" em vez de retirada no balcão. Fica salvo no pedido
// só pra aparecer no Histórico e na notinha impressa (não entra no
// rastreamento de entrega do site — sem entregador, sem mapa).
//
// A lógica fica em handler.ts (testada em handler.test.ts); aqui só liga
// o handler ao Deno, ao Supabase de verdade e às variáveis de ambiente.
// ─────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireStoreAdmin } from "../_shared/authGuard.ts";
import { handlePdvSale } from "./handler.ts";

Deno.serve((req) =>
  handlePdvSale(req, {
    requireStoreAdmin,
    serviceClient: () =>
      createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
  })
);
