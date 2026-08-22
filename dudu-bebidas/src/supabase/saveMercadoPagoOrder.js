import { supabase, getCurrentStoreId } from "./Supabaseclient";

const GENERIC_ERROR = "Não foi possível processar o pagamento. Tente novamente.";

// Cria o pedido E cobra o cartão numa única chamada (mercadopago-create-payment)
// — cardData vem do onSubmit do Card Payment Brick (token já tokenizado no
// navegador, nunca o número do cartão em si).
export async function saveMercadoPagoOrder({ address, cartItems, cardData, deliveryFee = 0 }) {
  if (!cartItems || cartItems.length === 0) return { error: "Carrinho vazio." };

  try {
    const storeId = getCurrentStoreId();

    const { data, error } = await supabase.functions.invoke("mercadopago-create-payment", {
      body: {
        storeId,
        address,
        cartItems,
        deliveryFee,
        token: cardData.token,
        paymentMethodId: cardData.payment_method_id,
        issuerId: cardData.issuer_id,
        installments: cardData.installments,
        payer: cardData.payer,
      },
      headers: storeId ? { "x-store-id": storeId } : undefined,
    });

    if (error) {
      console.error("Erro na Edge Function:", error);
      return { error: GENERIC_ERROR };
    }
    if (data?.error) {
      return { error: data.error };
    }

    return { orderId: data.orderId, paymentStatus: data.paymentStatus };
  } catch (err) {
    console.error("Erro inesperado:", err);
    return { error: GENERIC_ERROR };
  }
}
