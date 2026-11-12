// ─────────────────────────────────────────────────────────────
// Edge Function: infinitepay-checkout
//
// Site → cria o link de pagamento da InfinitePay do pedido (action
// "create") ou confere o pagamento quando o cliente volta (action "check").
// Lógica em handler.ts (testada em handler.test.ts).
// ─────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleInfinitePayCheckout } from "./handler.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

Deno.serve((req) =>
  handleInfinitePayCheckout(req, {
    serviceClient: () => createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
    functionsBaseUrl: `${SUPABASE_URL}/functions/v1`,
  })
);
