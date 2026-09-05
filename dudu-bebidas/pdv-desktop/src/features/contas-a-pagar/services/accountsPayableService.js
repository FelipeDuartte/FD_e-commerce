import { supabase, getCurrentStoreId } from "../../../shared/supabase/Supabaseclient";
import { AdminServiceError } from "../../../shared/services/AdminServiceError";

async function getCurrentUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

const optionalValue = (value) => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
};

// Soma N meses a uma data "YYYY-MM-DD" sem passar por fuso (evita o bug
// clássico de "dia 31 + 1 mês vira dia 1 do mês seguinte" quando o mês de
// destino é mais curto — trava no último dia dele).
function addMonths(dateStr, months) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, lastDay));
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
}

export function buildBillPayload(form) {
  return {
    store_id: getCurrentStoreId(),
    description: String(form.description).trim(),
    supplier: optionalValue(form.supplier),
    document_type: optionalValue(form.document_type),
    document_number: optionalValue(form.document_number),
    category: optionalValue(form.category),
    amount: Number(form.amount),
    due_date: form.due_date,
    notes: optionalValue(form.notes),
  };
}

export function validateBillPayload(bill) {
  if (!bill.description) return "Informe o que essa conta se refere.";
  if (!bill.due_date) return "Informe a data de vencimento.";
  if (!Number.isFinite(bill.amount) || bill.amount <= 0) return "Informe um valor válido.";
  return null;
}

export async function listAccountsPayable() {
  const { data, error } = await supabase
    .from("accounts_payable")
    .select("*")
    .order("due_date");

  if (error) {
    throw new AdminServiceError("Não foi possível carregar as contas a pagar.", error);
  }
  return data ?? [];
}

// repeatMonths > 1 gera N contas independentes (mesmo valor/fornecedor,
// vencimento indo de mês em mês) — conveniência pra contas recorrentes tipo
// consórcio/honorário, sem criar um conceito de "série" ligada no banco.
export async function createAccountPayable(bill, repeatMonths = 1) {
  const userId = await getCurrentUserId();
  const count = Math.max(1, Math.floor(repeatMonths) || 1);
  const rows = Array.from({ length: count }, (_, i) => ({
    ...bill,
    due_date: i === 0 ? bill.due_date : addMonths(bill.due_date, i),
    created_by: userId,
  }));

  const { error } = await supabase.from("accounts_payable").insert(rows);
  if (error) {
    throw new AdminServiceError("Não foi possível criar a conta.", error);
  }
}

export async function updateAccountPayable(id, bill) {
  const { error } = await supabase
    .from("accounts_payable")
    .update(bill)
    .eq("id", id)
    .eq("store_id", bill.store_id);

  if (error) {
    throw new AdminServiceError("Não foi possível salvar a conta.", error);
  }
}

// amountPaid é o valor pago NESSA baixa, não o total — soma ao que já
// tinha sido pago antes (dá pra "baixar" uma conta em mais de uma vez até
// quitar). paidAt fica sempre com a data da baixa mais recente.
export async function markAccountPayablePaid(bill, { paidAt, amountPaid }) {
  const totalPaid = Number(bill.amount_paid ?? 0) + Number(amountPaid);
  const { error } = await supabase
    .from("accounts_payable")
    .update({ paid_at: paidAt, amount_paid: totalPaid })
    .eq("id", bill.id)
    .eq("store_id", bill.store_id);

  if (error) {
    throw new AdminServiceError("Não foi possível registrar o pagamento.", error);
  }
}

export async function unmarkAccountPayablePaid(bill) {
  const { error } = await supabase
    .from("accounts_payable")
    .update({ paid_at: null, amount_paid: null })
    .eq("id", bill.id)
    .eq("store_id", bill.store_id);

  if (error) {
    throw new AdminServiceError("Não foi possível desfazer o pagamento.", error);
  }
}

export async function deleteAccountPayable(bill) {
  const { error } = await supabase
    .from("accounts_payable")
    .delete()
    .eq("id", bill.id)
    .eq("store_id", bill.store_id);

  if (error) {
    throw new AdminServiceError("Não foi possível excluir a conta.", error);
  }
}
