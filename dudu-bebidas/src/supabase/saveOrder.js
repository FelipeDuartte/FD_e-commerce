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

  // ── 1. Inserir o pedido ─────────────────────────────────
  // ✅ userId pode ser null (compra como convidado)
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id:        userId ?? null,
      total,
      payment_method: paymentMethod,
      address:        address,
      status:         "pending",
    })
    .select("id")
    .single();

  if (orderError) {
    console.error("Erro ao criar pedido:", orderError);
    return { error: "Não foi possível criar o pedido. Tente novamente." };
  }

  // ── 2. Inserir os itens do pedido ───────────────────────
  const orderItems = cartItems.map((item) => ({
    order_id:   order.id,
    product_id: String(item.id),
    name:       item.name,
    price:      item.price,
    quantity:   item.quantity,
  }));

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItems);

  if (itemsError) {
    console.error("Erro ao salvar itens:", itemsError);
    return { error: "Pedido criado, mas houve um erro ao salvar os itens." };
  }

  // ── 3. Baixa no estoque via RPC ─────────────────────────
  const rpcItems = cartItems.map((item) => ({
    product_id: String(item.id),
    quantity:   item.quantity,
  }));

  const { data: rpcResult, error: rpcError } = await supabase
    .rpc("process_order", {
      p_order_id: order.id,
      p_items:    rpcItems,
    });

  if (rpcError) {
    console.error("Erro na RPC:", rpcError);
    return { error: "Pedido salvo, mas houve um erro ao atualizar o estoque." };
  }

  if (!rpcResult?.success) {
    console.error("Erro no estoque:", rpcResult?.error);
    return { error: rpcResult?.error ?? "Erro ao processar estoque." };
  }

  return { orderId: order.id };
}