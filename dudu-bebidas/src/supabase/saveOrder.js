import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://ixjhyzzocdsufcqgbbvf.supabase.co",
  "sb_publishable_kA5ukt5jIQMlUGAw7PVfSA_wsoJIhL_"
);

/**
 * Salva um pedido completo no Supabase.
 *
 * @param {Object} params
 * @param {string} params.userId        - ID do usuário autenticado
 * @param {number} params.total         - Total do carrinho
 * @param {string} params.paymentMethod - Forma de pagamento selecionada
 * @param {Object} params.address       - Objeto com os dados de endereço
 * @param {Array}  params.cartItems     - Array de { id, name, price, quantity }
 *
 * @returns {{ orderId: string } | { error: string }}
 */
export async function saveOrder({ userId, total, paymentMethod, address, cartItems }) {

  // ── Validações básicas ──────────────────────────────────
  if (!userId)                      return { error: "Usuário não autenticado." };
  if (!cartItems || cartItems.length === 0) return { error: "Carrinho vazio." };
  if (!paymentMethod)               return { error: "Forma de pagamento não selecionada." };
  if (!address?.street)             return { error: "Endereço incompleto." };

  // ── 1. Inserir o pedido ─────────────────────────────────
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      total,
      payment_method: paymentMethod,
      address, // objeto JSON completo
    })
    .select("id")
    .single();

  if (orderError) {
    console.error("Erro ao criar pedido:", orderError);
    return { error: "Não foi possível criar o pedido. Tente novamente." };
  }

  // ── 2. Inserir os itens do pedido ───────────────────────
  const orderItems = cartItems.map((item) => ({
    order_id: order.id,
    product_id: String(item.id),
    name: item.name,
    price: item.price,
    quantity: item.quantity,
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItems);

  if (itemsError) {
    console.error("Erro ao salvar itens:", itemsError);
    // Pedido foi criado mas itens falharam — loga para investigar
    return { error: "Pedido criado, mas houve um erro ao salvar os itens." };
  }

  return { orderId: order.id };
}