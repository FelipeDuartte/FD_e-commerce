// ─────────────────────────────────────────────────────────────
// Edge Function: infinitepay-webhook  (verify_jwt = false)
//
// Endereço que vai em cada link de pagamento da InfinitePay. Lógica em
// handler.ts (testada em handler.test.ts).
// ─────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleInfinitePayWebhook } from "./handler.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

Deno.serve((req) =>
  handleInfinitePayWebhook(req, {
    serviceClient: () =>
      createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
    background: (task) => {
      if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(task);
    },
  })
);
