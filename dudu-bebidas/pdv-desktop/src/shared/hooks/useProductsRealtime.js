import { useEffect, useRef } from "react";
import { supabase, getCurrentStoreId } from "../supabase/Supabaseclient";

// Rajadas de eventos (uma venda com 5 itens + fardos dispara vários UPDATE
// em sequência) viram uma única atualização de tela.
const FLUSH_MS = 150;

// Escuta mudanças em products da loja (venda, compra, cancelamento, fardo —
// de qualquer terminal ou do site) e entrega as LINHAS alteradas, que já vêm
// no próprio evento. Antes cada evento baixava a lista inteira de novo e
// escondia a grade da Venda enquanto isso — numa rajada de vendas a tela
// travava (clique em produto caindo no vazio, digitação engasgando).
//
// onRows(rows): linhas novas/alteradas, agrupadas.
// onResync(): conexão caiu e voltou — eventos podem ter sido perdidos, quem
//   chamou deve recarregar a lista inteira.
//
// Usado em mais de um lugar ao mesmo tempo (Venda e Produtos ficam montados
// o tempo todo) — nome de canal fixo colidia entre instâncias ("cannot add
// postgres_changes callbacks... after subscribe()"), por isso o sufixo único.
export function useProductsRealtime(onRows, onResync) {
  const instanceId = useRef(Math.random().toString(36).slice(2));
  const onRowsRef = useRef(onRows);
  const onResyncRef = useRef(onResync);

  useEffect(() => {
    onRowsRef.current = onRows;
    onResyncRef.current = onResync;
  });

  useEffect(() => {
    const storeId = getCurrentStoreId();
    let buffer = new Map();
    let timer = null;
    let subscribedOnce = false;

    const flush = () => {
      timer = null;
      const rows = [...buffer.values()];
      buffer = new Map();
      if (rows.length) onRowsRef.current?.(rows);
    };

    const handleChange = (payload) => {
      const row = payload.new;
      if (!row?.id) return;
      buffer.set(row.id, { ...buffer.get(row.id), ...row });
      if (!timer) timer = setTimeout(flush, FLUSH_MS);
    };

    const channel = supabase
      .channel(`pdv-products-${storeId}-${instanceId.current}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "products", filter: `store_id=eq.${storeId}` },
        handleChange,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "products", filter: `store_id=eq.${storeId}` },
        handleChange,
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        if (subscribedOnce) onResyncRef.current?.();
        subscribedOnce = true;
      });

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, []);
}
