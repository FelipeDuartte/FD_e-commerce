import { supabase, getCurrentStoreId } from "../../../shared/supabase/Supabaseclient";
import { validateOrder } from "../utils/checkoutValidation";

const GENERIC_ORDER_ERROR =
  "Não foi possível criar o pedido. Tente novamente.";

export async function saveOrder(order) {
  const validationError = validateOrder(order);
  if (validationError) return { error: validationError };

  try {
    const storeId = getCurrentStoreId();

    // ✅ Chama a Edge Function — usa service role internamente, bypassa RLS.
    // MULTI-LOJA: envia a loja tanto no header (padrão usado em toda chamada
    // ao Supabase) quanto no corpo (fallback), pra Edge Function identificar
    // corretamente qual loja está criando o pedido.
    const { data, error } = await supabase.functions.invoke("create-order", {
      body: { ...order, storeId },
      headers: storeId ? { "x-store-id": storeId } : undefined,
    });

    if (error) {
      console.error("Erro na Edge Function:", error);
      return { error: GENERIC_ORDER_ERROR };
    }

    if (data?.error) {
      return { error: data.error };
    }

    return { orderId: data.orderId, orderNumber: data.orderNumber };
  } catch (err) {
    console.error("Erro inesperado:", err);
    return { error: GENERIC_ORDER_ERROR };
  }
}
