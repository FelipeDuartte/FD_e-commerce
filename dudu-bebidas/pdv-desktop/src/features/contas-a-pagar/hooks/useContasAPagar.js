import { useCallback, useEffect, useState } from "react";
import {
  buildBillPayload,
  createAccountPayable,
  deleteAccountPayable,
  listAccountsPayable,
  markAccountPayablePaid,
  unmarkAccountPayablePaid,
  updateAccountPayable,
  validateBillPayload,
} from "../services/accountsPayableService";
import { getBillStatus } from "../billStatus";
import { useAccountsPayableRealtime } from "./useAccountsPayableRealtime";

export const EMPTY_BILL = {
  description: "",
  supplier: "",
  document_type: "",
  document_number: "",
  category: "",
  amount: "",
  due_date: "",
  notes: "",
};

export function useContasAPagar() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todas");
  // Filtro por vencimento — datas em texto "YYYY-MM-DD" (mesmo formato do
  // <input type="date">), comparação direta funciona porque due_date do
  // banco já vem nesse formato.
  const [dueDateFrom, setDueDateFrom] = useState("");
  const [dueDateTo, setDueDateTo] = useState("");

  const [billModal, setBillModal] = useState(null);
  const [modalForm, setModalForm] = useState(EMPTY_BILL);
  const [repeatMonths, setRepeatMonths] = useState(1);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  const [payingBill, setPayingBill] = useState(null);
  const [payingSaving, setPayingSaving] = useState(false);
  const [payingError, setPayingError] = useState("");
  const [unmarkingId, setUnmarkingId] = useState(null);

  const [billToDelete, setBillToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const fetchBills = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setBills(await listAccountsPayable());
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  // Recarrega quando OUTRO terminal cria, edita, paga ou exclui uma conta.
  useAccountsPayableRealtime(fetchBills);

  const filteredBills = bills.filter((b) => {
    const matchStatus = statusFilter === "todas" || getBillStatus(b) === statusFilter;
    const term = search.trim().toLowerCase();
    const matchSearch =
      !term ||
      b.description.toLowerCase().includes(term) ||
      (b.supplier ?? "").toLowerCase().includes(term) ||
      (b.category ?? "").toLowerCase().includes(term);
    const matchDateFrom = !dueDateFrom || b.due_date >= dueDateFrom;
    const matchDateTo = !dueDateTo || b.due_date <= dueDateTo;
    return matchStatus && matchSearch && matchDateFrom && matchDateTo;
  });

  const openNewBill = () => {
    setModalForm(EMPTY_BILL);
    setRepeatMonths(1);
    setModalError("");
    setBillModal("new");
  };

  const openEditBill = (bill) => {
    setModalForm({
      description: bill.description,
      supplier: bill.supplier ?? "",
      document_type: bill.document_type ?? "",
      document_number: bill.document_number ?? "",
      category: bill.category ?? "",
      amount: bill.amount,
      due_date: bill.due_date,
      notes: bill.notes ?? "",
    });
    setRepeatMonths(1);
    setModalError("");
    setBillModal(bill);
  };

  const handleModalChange = ({ target: { name, value } }) => {
    setModalForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleModalSave = async (e) => {
    e.preventDefault();
    setModalSaving(true);
    setModalError("");

    const payload = buildBillPayload(modalForm);
    const validationError = validateBillPayload(payload);
    if (validationError) {
      setModalError(validationError);
      setModalSaving(false);
      return;
    }

    try {
      if (billModal === "new") {
        await createAccountPayable(payload, repeatMonths);
      } else {
        await updateAccountPayable(billModal.id, payload);
      }
      await fetchBills();
      setBillModal(null);
    } catch (e) {
      setModalError(e.message);
    }
    setModalSaving(false);
  };

  const requestMarkPaid = (bill) => {
    setPayingError("");
    setPayingBill(bill);
  };

  const dismissMarkPaid = () => {
    if (payingSaving) return;
    setPayingBill(null);
    setPayingError("");
  };

  const confirmMarkPaid = async ({ paidAt, amountPaid }) => {
    if (!payingBill) return;
    setPayingSaving(true);
    setPayingError("");
    try {
      await markAccountPayablePaid(payingBill, { paidAt, amountPaid });
      await fetchBills();
      setPayingBill(null);
    } catch (e) {
      setPayingError(e.message);
    }
    setPayingSaving(false);
  };

  const handleUnmarkPaid = async (bill) => {
    setUnmarkingId(bill.id);
    setError("");
    try {
      await unmarkAccountPayablePaid(bill);
      await fetchBills();
    } catch (e) {
      setError(e.message);
    }
    setUnmarkingId(null);
  };

  const requestDelete = (bill) => {
    setDeleteError("");
    setBillToDelete(bill);
  };

  const dismissDelete = () => {
    if (deleting) return;
    setBillToDelete(null);
    setDeleteError("");
  };

  const confirmDelete = async () => {
    if (!billToDelete) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteAccountPayable(billToDelete);
      setBills((prev) => prev.filter((b) => b.id !== billToDelete.id));
      setBillToDelete(null);
    } catch (e) {
      setDeleteError(e.message);
    }
    setDeleting(false);
  };

  return {
    bills, filteredBills, loading, error, search, setSearch, statusFilter, setStatusFilter,
    dueDateFrom, setDueDateFrom, dueDateTo, setDueDateTo,
    billModal, setBillModal, modalForm, repeatMonths, setRepeatMonths, modalSaving, modalError,
    openNewBill, openEditBill, handleModalChange, handleModalSave,
    payingBill, payingSaving, payingError, requestMarkPaid, dismissMarkPaid, confirmMarkPaid,
    unmarkingId, handleUnmarkPaid,
    billToDelete, deleting, deleteError, requestDelete, dismissDelete, confirmDelete,
  };
}
