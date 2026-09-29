import { useEffect } from "react";
import { supabase } from "../../../shared/supabase/Supabaseclient";

// cash_sessions é único por loja (não por computador) — vários terminais
// PDV podem vender pro MESMO caixa aberto ao mesmo tempo. Sem isso, uma
// venda feita num terminal só aparecia nos outros na próxima vez que eles
// mesmos vendessem/cancelassem algo (só aí recarregavam do banco). Mesmo
// padrão já usado no painel de Pedidos do admin web (useOrdersRealtime.js),
// só que filtrado pelo caixa aberto em vez da loja inteira.
export function useSaleRealtime(sessionId, onChange) {
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`pdv-session-sales-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `cash_session_id=eq.${sessionId}` },
        onChange,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `cash_session_id=eq.${sessionId}` },
        onChange,
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [sessionId, onChange]);
}
