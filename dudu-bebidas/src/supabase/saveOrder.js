import { supabase } from "./Supabaseclient";

export async function saveOrder({ userId, total, paymentMethod, address, cartItems }) {

  // ── Validações básicas ──────────────────────────────────
  if (!cartItems || cartItems.length === 0) return { error: "Carrinho vazio." };
  if (!paymentMethod) return { error: "Forma de pagamento não selecionada." };

  // ── Validação de endereço ───────────────────────────────
  const isRetirada = address?.isRetirada === true;

  if (!isRetirada) {
    if (!address?.street)   return { error: "Endereço incompleto. Informe a rua." };
    if (!address?.number)   return { error: "Endereço incompleto. Informe o número." };
    if (!address?.district) return { error: "Endereço incompleto. Informe o bairro." };
    if (!address?.cep)      return { error: "Endereço incompleto. Informe o CEP." };
  } else {
    if (!address?.name)  return { error: "Informe seu nome para retirada." };
    if (!address?.phone) return { error: "Informe seu telefone para contato." };
  }

  try {
    // ✅ Chama a Edge Function — usa service role internamente, bypassa RLS
    const { data, error } = await supabase.functions.invoke("create-order", {
      body: { userId, total, paymentMethod, address, cartItems },
    });

    if (error) {
      console.error("Erro na Edge Function:", error);
      return { error: "Não foi possível criar o pedido. Tente novamente." };
    }

    if (data?.error) {
      return { error: data.error };
    }

    return { orderId: data.orderId };

  } catch (err) {
    console.error("Erro inesperado:", err);
    return { error: "Não foi possível criar o pedido. Tente novamente." };
  }
}