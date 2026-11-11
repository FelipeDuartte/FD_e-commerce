// ─────────────────────────────────────────────────────────────
// Edge Function: mercadopago-webhook
//
// Recebe as notificações assíncronas do Mercado Pago (pagamento
// aprovado depois de estar "in_process", estornos, etc). Nunca
// confia em nada do corpo da notificação além do id — sempre
// rebusca o pagamento na API do MP com o access_token da própria
// loja antes de decidir qualquer coisa.
//
// A loja é identificada pelo query param ?store_id=..., configurado
// na URL de notificação de CADA aplicação do MP (uma aplicação =
// uma conta MP = uma loja, nesse desenho). Sem isso não daria pra
// saber qual store_payment_configs.mercadopago_access_token usar só
// a partir do payload — o Mercado Pago não manda esse dado.
//
// Sempre responde 200 rápido pra qualquer notificação que não seja
// "payment" ou que já tenha sido processada — o MP reenvia
// notificações que não recebem 2xx, então tratar como erro faria
// ele martelar o mesmo evento repetidamente.
//
// A lógica fica em handler.ts (testada em handler.test.ts); aqui só liga
// o handler ao Deno, ao Supabase de verdade e às variáveis de ambiente.
// ─────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleMercadoPagoWebhook } from "./handler.ts";

Deno.serve((req) =>
  handleMercadoPagoWebhook(req, {
    serviceClient: () =>
      createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
  })
);
