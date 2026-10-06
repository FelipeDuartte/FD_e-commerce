import { useEffect } from "react";
import { supabase, getCurrentStoreId } from "../../../shared/supabase/Supabaseclient";

// Saldo de fiado (pdv_customer_balances) é uma VIEW — Realtime não escuta
// view, só tabela de verdade. Por isso a inscrição é nas 3 tabelas que
// formam o saldo: vendas fiado (orders), pagamentos e lançamentos
// manuais. Mesmo motivo de sempre: caixa/cliente sendo mexido em mais de
// um computador ao mesmo tempo (ver useSaleRealtime.js).
export function useFiadoBalancesRealtime(onChange) {
  useEffect(() => {
    const storeId = getCurrentStoreId();
    if (!storeId) return;

    const channel = supabase
      .channel(`pdv-fiado-balances-${storeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
        (payload) => {
          // Só fiado mexe em saldo — venda em dinheiro/cartão não precisa
          // disparar um reload aqui.
          if (payload.new?.payment_method === "fiado" || payload.old?.payment_method === "fiado") {
            onChange();
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pdv_customer_payments", filter: `store_id=eq.${storeId}` },
        onChange,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pdv_customer_charges", filter: `store_id=eq.${storeId}` },
        onChange,
      )
      .subscribe((status) => {
        // Eventos que chegaram durante uma queda de conexão se perdem —
        // recarregar toda vez que a inscrição é (re)confirmada cobre isso.
        if (status === "SUBSCRIBED") onChange();
      });

    return () => supabase.removeChannel(channel);
  }, [onChange]);
}

// Detalhe de UM cliente (transações da tela aberta) — só dispara pra
// mudanças ligadas a esse cliente específico.
export function useCustomerDetailRealtime(customerId, onChange) {
  useEffect(() => {
    if (!customerId) return;

    const channel = supabase
      .channel(`pdv-fiado-customer-${customerId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `pdv_customer_id=eq.${customerId}` },
        onChange,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pdv_customer_payments", filter: `customer_id=eq.${customerId}` },
        onChange,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pdv_customer_charges", filter: `customer_id=eq.${customerId}` },
        onChange,
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") onChange();
      });

    return () => supabase.removeChannel(channel);
  }, [customerId, onChange]);
}
