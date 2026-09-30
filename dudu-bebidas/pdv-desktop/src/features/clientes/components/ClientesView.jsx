import { useState } from "react";
import { useCustomerDetail } from "../hooks/useCustomerDetail";
import CustomerListPanel from "./CustomerListPanel";
import CustomerEditForm from "./CustomerEditForm";
import CustomerDetailHeader from "./CustomerDetailHeader";
import CustomerTransactionList from "./CustomerTransactionList";
import PayDebtModal from "./PayDebtModal";
import NewChargeModal from "./NewChargeModal";
import DeleteCustomerModal from "./DeleteCustomerModal";

export default function ClientesView({
  customers, customersLoading, customersError, payDebt, addCharge, createCustomer,
  updateCustomer, setCustomerActive, deleteCustomer,
  currentSessionId, cancellingId, onCancelSale, onRemoveItem,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [editing, setEditing] = useState(false);

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payError, setPayError] = useState("");

  const [chargeModalOpen, setChargeModalOpen] = useState(false);
  const [chargeError, setChargeError] = useState("");

  const [togglingActive, setTogglingActive] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Deriva do array atualizado em vez de guardar o objeto — assim o saldo
  // exibido sempre reflete o último pagamento, sem precisar sincronizar.
  const selected = customers.find((c) => c.id === selectedId) ?? null;

  const detail = useCustomerDetail(selectedId, selected);

  const selectCustomer = (id) => {
    setSelectedId(id);
    setEditing(false);
  };

  const handleCustomerCreated = (customer) => {
    selectCustomer(customer.id);
    setCreatingCustomer(false);
  };

  const handleSaveEdit = async (fields) => {
    await updateCustomer(selected.id, fields);
    setEditing(false);
  };

  const handlePay = async ({ amount, paymentMethod }) => {
    setPayError("");
    try {
      await payDebt({ customerId: selected.id, amount, paymentMethod });
      detail.reload();
      setPayModalOpen(false);
    } catch (e) {
      setPayError(e.message);
      throw e;
    }
  };

  const handleAddCharge = async ({ amount, description }) => {
    setChargeError("");
    try {
      await addCharge({ customerId: selected.id, amount, description });
      detail.reload();
      setChargeModalOpen(false);
    } catch (e) {
      setChargeError(e.message);
      throw e;
    }
  };

  const handleToggleActive = async () => {
    setTogglingActive(true);
    setStatusError("");
    try {
      await setCustomerActive(selected.id, !selected.isActive);
    } catch (e) {
      setStatusError(e.message);
    }
    setTogglingActive(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteCustomer(selected.id);
      setDeleteModalOpen(false);
      setSelectedId(null);
    } catch (e) {
      setDeleteError(e.message);
    }
    setDeleting(false);
  };

  return (
    <div className="pdv-fiado-view">
      <CustomerListPanel
        customers={customers}
        customersLoading={customersLoading}
        customersError={customersError}
        selectedId={selectedId}
        onSelect={selectCustomer}
        creatingCustomer={creatingCustomer}
        onToggleCreating={() => setCreatingCustomer((v) => !v)}
        createCustomer={createCustomer}
        onCustomerCreated={handleCustomerCreated}
      />

      <div className="pdv-fiado-detail">
        {!selected ? (
          <div className="pdv-clientes-empty-detail">
            <span className="pdv-clientes-empty-icon">👤</span>
            <p className="pdv-clientes-empty-title">Nenhum cliente selecionado</p>
            <p className="pdv-clientes-empty-desc">
              Escolha um cliente na lista ao lado pra ver o perfil completo — saldo, histórico de
              compras e pagamentos.
            </p>
          </div>
        ) : editing ? (
          <CustomerEditForm customer={selected} onSave={handleSaveEdit} onCancel={() => setEditing(false)} />
        ) : (
          <>
            <CustomerDetailHeader
              customer={selected}
              ordersLoading={detail.ordersLoading}
              ordersCount={detail.orders.filter((o) => !o.cancelled).length}
              onEdit={() => setEditing(true)}
              onPay={() => setPayModalOpen(true)}
              onNewCharge={() => setChargeModalOpen(true)}
              onToggleActive={handleToggleActive}
              togglingActive={togglingActive}
              onRequestDelete={() => setDeleteModalOpen(true)}
              payError={payError}
              chargeError={chargeError}
              statusError={statusError}
            />

            <CustomerTransactionList
              ordersLoading={detail.ordersLoading}
              filteredTransactions={detail.filteredTransactions}
              txFilter={detail.txFilter}
              setTxFilter={detail.setTxFilter}
              paidDebitIds={detail.paidDebitIds}
              currentSessionId={currentSessionId}
              cancellingId={cancellingId}
              onCancelSale={onCancelSale}
              onRemoveItem={onRemoveItem}
            />
          </>
        )}
      </div>

      {payModalOpen && selected && (
        <PayDebtModal customer={selected} onConfirm={handlePay} onDismiss={() => setPayModalOpen(false)} />
      )}

      {chargeModalOpen && selected && (
        <NewChargeModal customer={selected} onConfirm={handleAddCharge} onDismiss={() => setChargeModalOpen(false)} />
      )}

      {deleteModalOpen && selected && (
        <DeleteCustomerModal
          customer={selected}
          deleting={deleting}
          deleteError={deleteError}
          onConfirm={handleDelete}
          onDismiss={() => setDeleteModalOpen(false)}
        />
      )}
    </div>
  );
}
