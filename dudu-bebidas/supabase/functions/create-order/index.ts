// ─────────────────────────────────────────────────────────────
// Edge Function: create-order  (MULTI-LOJA)
//
// Diferenças em relação à versão original de loja única:
//   1. Identifica a loja pelo header "x-store-id" (enviado pelo front-end em
//      toda chamada — mesmo header usado nas queries diretas ao Supabase,
//      ver Supabaseclient.js na documentação).
//   2. Confirma que a loja existe e está ativa antes de processar qualquer coisa.
//   3. Toda consulta a "products" é filtrada por store_id (produtos de outra
//      loja são tratados como "não encontrados" — nunca vazam nem por engano).
//   4. O pedido é gravado com store_id. Os itens do pedido NÃO precisam
//      enviar store_id manualmente: um trigger no banco preenche isso
//      automaticamente a partir do pedido pai.
//
// Aceita convidado (sem sessão) — checkout público. Para venda de balcão
// (admin autenticado, sem entrega), ver a function irmã pdv-sale, que
// reaproveita a mesma lógica de preço/estoque via _shared/orderFulfillment.ts.
//
// A lógica fica em handler.ts (testada em handler.test.ts); aqui só liga
// o handler ao Deno, ao Supabase de verdade e às variáveis de ambiente.
// ─────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCreateOrder } from "./handler.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

Deno.serve((req) =>
  handleCreateOrder(req, {
    serviceClient: () => createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
    getUserId: async (authorization) => {
      const authClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authorization } },
      });
      const { data: { user } } = await authClient.auth.getUser();
      return user?.id ?? null;
    },
  })
);
