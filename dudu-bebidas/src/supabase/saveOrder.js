// supabase/saveOrder.js
import { supabase } from "./Supabaseclient";

/**
 * Salva um pedido completo no Supabase.
 *
 * @param {Object} params
 * @param {string} params.userId       
 * @param {number} params.total         
 * @param {string} params.paymentMethod 
 * @param {Object} params.address       
 * @param {Array}  params.cartItems     
 *
 * @returns {{ orderId: string } | { error: string }}
 */
export async function saveOrder({ userId, total, paymentMethod, address, cartItems }) {

  // ── Validações básicas ──────────────────────────────────
  if (!userId) return { error: "Usuário não autenticado." };
  if (!cartItems || cartItems.length === 0) return { error: "Carrinho vazio." };
  if (!paymentMethod) return { error: "Forma de pagamento não selecionada." };
  
  // ── Validação de endereço APENAS para entregas ──────────
  const isRetirada = address?.isRetirada === true;
  
  if (!isRetirada) {
    // Só valida endereço completo se NÃO for retirada
    if (!address?.street) return { error: "Endereço incompleto. Informe a rua." };
    if (!address?.number) return { error: "Endereço incompleto. Informe o número." };
    if (!address?.district) return { error: "Endereço incompleto. Informe o bairro." };
    if (!address?.cep) return { error: "Endereço incompleto. Informe o CEP." };
  } else {
    // Para retirada, valida apenas nome e telefone
    if (!address?.name) return { error: "Informe seu nome para retirada." };
    if (!address?.phone) return { error: "Informe seu telefone para contato." };
  }

  // ── 1. Inserir o pedido ─────────────────────────────────
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      total,
      payment_method: paymentMethod,
      address: address, // objeto JSON completo
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