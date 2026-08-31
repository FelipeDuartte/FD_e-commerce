import { supabase, getCurrentStoreId } from "../supabase/Supabaseclient";
import { AdminServiceError } from "./AdminServiceError";

async function getCurrentUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

// pdv_customer_balances já soma vendas 'fiado' não canceladas menos
// pagamentos recebidos (ver migration 0012) — não recalcula nada aqui.
export async function listPdvCustomerBalances() {
  const { data, error } = await supabase
    .from("pdv_customer_balances")
    .select("customer_id, name, phone, balance, total_paid, total_fiado, last_order_at")
    .order("name");

  if (error) {
    throw new AdminServiceError("Não foi possível carregar os clientes.", error);
  }
  return (data ?? []).map((c) => ({
    id: c.customer_id,
    name: c.name,
    phone: c.phone,
    balance: Number(c.balance),
    totalPaid: Number(c.total_paid),
    totalFiado: Number(c.total_fiado),
    lastOrderAt: c.last_order_at,
  }));
}

export async function createPdvCustomer({ name, phone }) {
  const { data, error } = await supabase
    .from("pdv_customers")
    .insert({
      store_id: getCurrentStoreId(),
      name: String(name).trim(),
      phone: phone ? String(phone).trim() || null : null,
    })
    .select("id, name, phone")
    .single();

  if (error) {
    throw new AdminServiceError("Não foi possível cadastrar o cliente.", error);
  }
  return { id: data.id, name: data.name, phone: data.phone, balance: 0, totalPaid: 0, totalFiado: 0, lastOrderAt: null };
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

export async function listFiadoOrders(customerId) {
  const { data, error } = await supabase
    .from("orders")
    .select("id, total, status, created_at, order_items(name, quantity)")
    .eq("pdv_customer_id", customerId)
    .eq("payment_method", "fiado")
    .order("created_at", { ascending: false });

  if (error) {
    throw new AdminServiceError("Não foi possível carregar as vendas fiado do cliente.", error);
  }
  return (data ?? []).map((o) => ({
    orderId: o.id,
    total: o.total,
    cancelled: o.status === "cancelled",
    createdAt: o.created_at,
    itemsLabel: (o.order_items ?? [])
      .map((it) => (it.quantity > 1 ? `${it.name} x${it.quantity}` : it.name))
      .join(", "),
  }));
}
