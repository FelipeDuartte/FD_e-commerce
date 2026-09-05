// Status/dias/mês/semana não ficam salvos no banco — são sempre calculados
// aqui a partir de due_date/paid_at, pra nunca desatualizar.

function todayLocal() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`);
}

// Paga menos que o valor da conta = "parcial", não "pago" — senão o campo
// "valor pago" não significa nada (dar baixa em R$10 de uma conta de R$100
// fecharia ela igual a pagar os R$100 inteiros).
export function isFullyPaid(bill) {
  return Number(bill.amount_paid ?? 0) + 0.004 >= Number(bill.amount);
}

export function remainingAmount(bill) {
  return Math.max(0, Number(bill.amount) - Number(bill.amount_paid ?? 0));
}

export function getBillStatus(bill) {
  if (bill.paid_at) return isFullyPaid(bill) ? "pago" : "parcial";
  return parseDate(bill.due_date) < todayLocal() ? "vencido" : "a_vencer";
}

export const STATUS_LABEL = {
  a_vencer: "A Vencer",
  vencido: "Vencido",
  parcial: "Pago Parcial",
  pago: "Pago",
};

export const STATUS_ICON = {
  a_vencer: "⏳",
  vencido: "⚠️",
  parcial: "🟡",
  pago: "✅",
};

export function daysUntilDue(dueDate) {
  return Math.round((parseDate(dueDate) - todayLocal()) / 86400000);
}

export function weekLabel(days) {
  if (days < 0) return "Atrasado";
  const weeks = Math.floor(days / 7);
  if (weeks === 0) return "Esta semana";
  if (weeks === 1) return "Semana que vem";
  return `${weeks} sem. à frente`;
}

export function monthLabel(dueDate) {
  const d = parseDate(dueDate);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
