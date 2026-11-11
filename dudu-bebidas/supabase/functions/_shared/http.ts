// Respostas JSON com CORS — iguais em todas as functions chamadas pelo
// navegador (site e PDV).

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  // x-store-id é injetado em TODA chamada pelo Supabaseclient.js do front;
  // precisa estar liberado mesmo nas functions que não usam o header, senão
  // o preflight de CORS falha antes da requisição sair do navegador.
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-store-id",
};

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = corsHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
