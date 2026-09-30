import { useState } from "react";
import { useCustomerDetail } from "../hooks/useCustomerDetail";
import { createPdvSale } from "../../../shared/services/salesService";
import { settleFiadoStock } from "../services/fiadoService";
import CustomerListPanel from "./CustomerListPanel";
import CustomerEditForm from "./CustomerEditForm";
import CustomerDetailHeader from "./CustomerDetailHeader";
import CustomerTransactionList from "./CustomerTransactionList";
import PayDebtModal from "./PayDebtModal";
import NewFiadoOrderModal from "./NewFiadoOrderModal";
import DeleteCustomerModal from "./DeleteCustomerModal";

export default function ClientesView({
  customers, customersLoading, customersError, payDebt, createCustomer,
  updateCustomer, setCustomerActive, deleteCustomer,
  currentSessionId, cancellingId, onCancelSale, onRemoveItem, reloadProducts,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [editing, setEditing] = useState(false);

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payError, setPayError] = useState("");

  const [newOrderModalOpen, setNewOrderModalOpen] = useState(false);

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

  const handleNewOrder = async ({ cartItems, discountAmount }) => {
    await createPdvSale({
      cartItems,
      cashSessionId: currentSessionId,
      paymentMethod: "fiado",
      pdvCustomerId: selected.id,
      discountAmount,
      // Não baixa estoque na hora — só quando o pagamento cobrir esse
      // pedido (ver settle_fiado_stock). Chama aqui também (não só depois
      // de um pagamento) pro caso do cliente já ter crédito suficiente
      // sobrando pra cobrir esse pedido novo na mesma hora.
      deferStockUntilPaid: true,
    });
    await settleFiadoStock(selected.id);
    detail.reload();
    reloadProducts();
    setNewOrderModalOpen(false);
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
              onNewOrder={() => setNewOrderModalOpen(true)}
              onToggleActive={handleToggleActive}
              togglingActive={togglingActive}
              onRequestDelete={() => setDeleteModalOpen(true)}
              payError={payError}
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

      {newOrderModalOpen && selected && (
        <NewFiadoOrderModal customer={selected} onConfirm={handleNewOrder} onDismiss={() => setNewOrderModalOpen(false)} />
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
