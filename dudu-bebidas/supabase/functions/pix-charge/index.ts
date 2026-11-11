// ─────────────────────────────────────────────────────────────
// Edge Function: pix-charge
//
// Gera o QR/"Pix Copia e Cola" de um pedido já criado, usando a
// chave Pix cadastrada pela própria loja (sem gateway/PSP). Não cria
// nada — só lê o pedido (valor real, já calculado no servidor pelo
// create-order) e a configuração de pagamento da loja, e monta o
// payload padronizado do BACEN.
//
// Body esperado: { "orderId": "uuid", "storeId": "uuid" }
// Resposta: { brCode, pixKey, merchantName, amount }
//
// A lógica fica em handler.ts (testada em handler.test.ts); aqui só liga
// o handler ao Deno, ao Supabase de verdade e às variáveis de ambiente.
// ─────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handlePixCharge } from "./handler.ts";

Deno.serve((req) =>
  handlePixCharge(req, {
    serviceClient: () =>
      createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
  })
);
