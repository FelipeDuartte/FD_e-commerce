import { supabase, getCurrentStoreId } from "../../../shared/supabase/Supabaseclient";
import { AdminServiceError } from "../../../shared/services/AdminServiceError";

async function getCurrentUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

// pdv_customer_balances já soma vendas 'fiado' não canceladas menos
// pagamentos recebidos (ver migration 0012) — não recalcula nada aqui.
export async function listPdvCustomerBalances() {
  const { data, error } = await supabase
    .from("pdv_customer_balances")
    .select("customer_id, name, phone, email, address, is_active, balance, total_paid, total_fiado, last_order_at")
    .order("name");

  if (error) {
    throw new AdminServiceError("Não foi possível carregar os clientes.", error);
  }
  return (data ?? []).map((c) => ({
    id: c.customer_id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    address: c.address,
    isActive: c.is_active,
    balance: Number(c.balance),
    totalPaid: Number(c.total_paid),
    totalFiado: Number(c.total_fiado),
    lastOrderAt: c.last_order_at,
  }));
}

export async function createPdvCustomer({ name, phone, email, address }) {
  const { data, error } = await supabase
    .from("pdv_customers")
    .insert({
      store_id: getCurrentStoreId(),
      name: String(name).trim(),
      phone: phone ? String(phone).trim() || null : null,
      email: email ? String(email).trim() || null : null,
      address: address ? String(address).trim() || null : null,
    })
    .select("id, name, phone, email, address")
    .single();

  if (error) {
    throw new AdminServiceError("Não foi possível cadastrar o cliente.", error);
  }
  return {
    id: data.id, name: data.name, phone: data.phone, email: data.email, address: data.address,
    isActive: true, balance: 0, totalPaid: 0, totalFiado: 0, lastOrderAt: null,
  };
}

export async function updatePdvCustomer(customerId, { name, phone, email, address }) {
  const { error } = await supabase
    .from("pdv_customers")
    .update({
      name: String(name).trim(),
      phone: phone ? String(phone).trim() || null : null,
      email: email ? String(email).trim() || null : null,
      address: address ? String(address).trim() || null : null,
    })
    .eq("id", customerId);

  if (error) {
    throw new AdminServiceError("Não foi possível atualizar o cliente.", error);
  }
}

// Desativar é reversível (esconde do seletor de cliente na venda, mas
// mantém todo o histórico) — diferente de excluir, que é permanente.
export async function setPdvCustomerActive(customerId, isActive) {
  const { error } = await supabase
    .from("pdv_customers")
    .update({ is_active: isActive })
    .eq("id", customerId);

  if (error) {
    throw new AdminServiceError("Não foi possível atualizar o cliente.", error);
  }
}

// Só funciona se o cliente não tiver nenhuma venda/pagamento — a FK em
// orders.pdv_customer_id e pdv_customer_payments.customer_id garante isso
// no banco (23503 = foreign_key_violation), não precisa checar antes.
export async function deletePdvCustomer(customerId) {
  const { error } = await supabase
    .from("pdv_customers")
    .delete()
    .eq("id", customerId);

  if (error) {
    if (error.code === "23503") {
      throw new AdminServiceError("Esse cliente tem vendas ou pagamentos registrados — desative em vez de excluir.");
    }
    throw new AdminServiceError("Não foi possível excluir o cliente.", error);
  }
}

// cashSessionId opcional — só entra na conferência do caixa (close_cash_session)
// se recebido em dinheiro com um caixa aberto no momento.
export async function registerFiadoPayment({ customerId, amount, paymentMethod, cashSessionId }) {
  const userId = await getCurrentUserId();
  const { error } = await supabase.from("pdv_customer_payments").insert({
    store_id: getCurrentStoreId(),
    customer_id: customerId,
    amount,
    payment_method: paymentMethod,
    cash_session_id: cashSessionId ?? null,
    received_by: userId,
  });

  if (error) {
    throw new AdminServiceError("Não foi possível registrar o pagamento.", error);
  }
}

export async function listCustomerPayments(customerId) {
  const { data, error } = await supabase
    .from("pdv_customer_payments")
    .select("id, amount, payment_method, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AdminServiceError("Não foi possível carregar os pagamentos.", error);
  }
  return (data ?? []).map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    method: p.payment_method,
    createdAt: p.created_at,
  }));
}

// Lançamento livre de dívida (sem carrinho/estoque) — direto da aba
// Clientes, pra quando o operador só quer registrar "cliente ficou devendo
// X" sem passar pela venda. cashSessionId opcional, mesmo padrão de
// registerFiadoPayment.
export async function createPdvCustomerCharge({ customerId, amount, description, cashSessionId }) {
  const userId = await getCurrentUserId();
  const { error } = await supabase.from("pdv_customer_charges").insert({
    store_id: getCurrentStoreId(),
    customer_id: customerId,
    amount,
    description: String(description).trim(),
    cash_session_id: cashSessionId ?? null,
    created_by: userId,
  });

  if (error) {
    throw new AdminServiceError("Não foi possível lançar o pedido em aberto.", error);
  }
}

export async function listCustomerCharges(customerId) {
  const { data, error } = await supabase
    .from("pdv_customer_charges")
    .select("id, amount, description, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AdminServiceError("Não foi possível carregar os pedidos em aberto.", error);
  }
  return (data ?? []).map((c) => ({
    id: c.id,
    amount: Number(c.amount),
    description: c.description,
    createdAt: c.created_at,
  }));
}

export async function listFiadoOrders(customerId) {
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, total, status, created_at, cash_session_id, order_items(name, quantity)")
    .eq("pdv_customer_id", customerId)
    .eq("payment_method", "fiado")
    .order("created_at", { ascending: false });

  if (error) {
    throw new AdminServiceError("Não foi possível carregar as vendas fiado do cliente.", error);
  }
  return (data ?? []).map((o) => ({
    orderId: o.id,
    orderNumber: o.order_number,
    total: o.total,
    cancelled: o.status === "cancelled",
    createdAt: o.created_at,
    cashSessionId: o.cash_session_id,
    itemsLabel: (o.order_items ?? [])
      .map((it) => (it.quantity > 1 ? `${it.name} x${it.quantity}` : it.name))
      .join(", "),
  }));
}
