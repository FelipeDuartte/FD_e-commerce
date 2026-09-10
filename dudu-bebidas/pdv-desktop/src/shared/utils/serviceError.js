export function createServiceError(name) {
  return class extends Error {
    constructor(message, cause) {
      super(message);
      this.name = name;
      this.cause = cause;
      // Loga a causa real assim que o erro é criado — sem isso, a tela só
      // mostra a mensagem genérica ("Não foi possível salvar...") e o erro
      // de verdade do Supabase/Postgres fica invisível, escondido dentro
      // de `cause` sem ninguém nunca imprimir. Foi assim que o PGRST204 do
      // schema cache e o bug do current_store_id na RLS ficaram
      // escondidos por várias idas e vindas até alguém logar manualmente.
      if (cause) {
        console.error(`[${name}] ${message}`, cause);
      }
    }
  };
}
