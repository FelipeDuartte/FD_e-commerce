import { supabase, getCurrentStoreId } from "./Supabaseclient";

const GENERIC_ORDER_ERROR =
  "Não foi possível criar o pedido. Tente novamente.";

function validateOrder({ paymentMethod, address, cartItems }) {
  if (!cartItems || cartItems.length === 0) return "Carrinho vazio.";
  if (!paymentMethod) return "Forma de pagamento não selecionada.";

  const isRetirada = address?.isRetirada === true;

  if (!isRetirada) {
    if (!address?.street) return "Endereço incompleto. Informe a rua.";
    if (!address?.number) return "Endereço incompleto. Informe o número.";
    if (!address?.district) return "Endereço incompleto. Informe o bairro.";
    if (!address?.cep) return "Endereço incompleto. Informe o CEP.";
    return null;
  }

  if (!address?.name) return "Informe seu nome para retirada.";
  if (!address?.phone) return "Informe seu telefone para contato.";
  return null;
}

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

    return { orderId: data.orderId };
  } catch (err) {
    console.error("Erro inesperado:", err);
    return { error: GENERIC_ORDER_ERROR };
  }
}
