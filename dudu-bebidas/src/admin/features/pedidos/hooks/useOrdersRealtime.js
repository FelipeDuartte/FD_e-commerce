import { useEffect } from "react";
import { supabase, getCurrentStoreId } from "../../../../shared/supabase/Supabaseclient";
import { isPhantomMercadoPagoOrder } from "../orderStatus";
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
          // Cartão online recusado na hora (ex: teste com cartão "OTHE") não
          // é uma venda de verdade — não toca som nem gasta um refetch por
          // causa dele.
          if (isPhantomMercadoPagoOrder(payload.new)) return;
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
          // Reflete em tempo real qualquer mudança de status feita em outro
          // lugar — inclusive o cliente cancelando o próprio pedido
          // (Confirm.jsx), sem precisar dar refresh na página. Manda
          // payment_status/payment_provider junto (não só status) pra pegar
          // o cartão Mercado Pago que é recusado logo após ser criado.
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
