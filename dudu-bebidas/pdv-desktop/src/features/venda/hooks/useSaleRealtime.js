import { useEffect } from "react";

// Uma venda dispara vários eventos seguidos (INSERT do pedido, UPDATEs,
// pagamento) — sem agrupar, cada um rebaixava todas as vendas do caixa,
// que no fim do dia já são dezenas.
const COALESCE_MS = 300;
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

    let timer = null;
    const scheduleChange = () => {
      if (!timer) timer = setTimeout(() => { timer = null; onChange(); }, COALESCE_MS);
    };

    const channel = supabase
      .channel(`pdv-session-sales-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `cash_session_id=eq.${sessionId}` },
        scheduleChange,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `cash_session_id=eq.${sessionId}` },
        scheduleChange,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pdv_customer_payments", filter: `cash_session_id=eq.${sessionId}` },
        scheduleChange,
      )
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [sessionId, onChange]);
}
