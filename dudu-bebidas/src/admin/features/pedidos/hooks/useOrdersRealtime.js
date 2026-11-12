import { useEffect } from "react";
import { supabase, getCurrentStoreId } from "../../../../shared/supabase/Supabaseclient";
import { isHiddenUnpaidOrder } from "../orderStatus";
import { playNotificationSound } from "../notificationSound";

// Realtime: novos pedidos, exclusões e mudanças de status.
// MULTI-LOJA: filtro por store_id — sem isso, o admin de uma loja
// receberia som/refetch também quando OUTRA loja tivesse um pedido novo.
export function useOrdersRealtime(isAdmin, { onRefetch, onUpdateOrderLocally }) {
  useEffect(() => {
    if (!isAdmin) return;
    const storeId = getCurrentStoreId();
    if (!storeId) return;

    const channel = supabase
      .channel(`admin-orders-${storeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
        (payload) => {
          // Venda de balcão (PDV) não aparece na lista do site — não toca
          // som nem gasta um refetch por causa dela.
          if (payload.new.channel === "balcao") return;
          // Pagamento online ainda não pago (ou que falhou) não é venda de
          // verdade ainda — não toca som nem gasta um refetch.
          if (isHiddenUnpaidOrder(payload.new)) return;
          playNotificationSound();
          onRefetch();
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
        () => {
          onRefetch();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
        (payload) => {
          // Pagamento online acabou de ser confirmado: o pedido estava
          // escondido (não pago) e agora é pedido novo de verdade — som +
          // recarrega a lista pra ele aparecer.
          if (
            payload.new.channel !== "balcao" &&
            payload.new.payment_provider === "infinitepay" &&
            payload.new.payment_status === "pago" &&
            payload.new.status === "pending"
          ) {
            playNotificationSound();
            onRefetch();
            return;
          }
          // Reflete em tempo real qualquer mudança de status feita em outro
          // lugar — inclusive o cliente cancelando o próprio pedido
          // (Confirm.jsx), sem precisar dar refresh na página.
          onUpdateOrderLocally(payload.new.id, {
            status: payload.new.status,
            payment_status: payload.new.payment_status,
            payment_provider: payload.new.payment_provider,
          });
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [isAdmin, onRefetch, onUpdateOrderLocally]);
}
