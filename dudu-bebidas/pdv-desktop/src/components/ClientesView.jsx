import { useCallback, useEffect, useMemo, useState } from "react";
import { formatBRL, daysSince, formatLastOrder, formatPhone } from "../utils/format";
import { INACTIVE_CUSTOMER_DAYS, SPLIT_PAYMENT_METHODS } from "../constants";
import { listFiadoOrders, listCustomerPayments } from "../services/fiadoService";
import PayDebtModal from "./PayDebtModal";
import DeleteCustomerModal from "./DeleteCustomerModal";

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "debito", label: "Com débito" },
  { key: "credito", label: "Com crédito" },
  { key: "consomem", label: "Mais consomem" },
  { key: "inativos", label: "Inativos" },
];

const TX_FILTERS = [
  { key: "todas", label: "Todas" },
  { key: "compras", label: "Compras" },
  { key: "pagamentos", label: "Pagamentos" },
  { key: "canceladas", label: "Canceladas" },
];

function methodLabel(method) {
  const known = SPLIT_PAYMENT_METHODS.find((m) => m.value === method);
  return known ? `${known.icon} ${known.label}` : method;
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

const EMPTY_FORM = { name: "", phone: "", email: "", address: "" };

export default function ClientesView({
  customers, customersLoading, customersError, payDebt, createCustomer,
  updateCustomer, setCustomerActive, deleteCustomer,
  currentSessionId, cancellingId, onCancelSale,
}) {
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  const [txFilter, setTxFilter] = useState("todas");

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payError, setPayError] = useState("");

  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  const [togglingActive, setTogglingActive] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const [printingTx, setPrintingTx] = useState(null);

  // Deriva do array atualizado em vez de guardar o objeto — assim o saldo
  // exibido sempre reflete o último pagamento, sem precisar sincronizar.
  const selected = customers.find((c) => c.id === selectedId) ?? null;

  const loadDetail = useCallback(async (customerId) => {
    if (!customerId) {
      setOrders([]);
      setPayments([]);
      return;
    }
    setOrdersLoading(true);
    try {
      const [o, p] = await Promise.all([listFiadoOrders(customerId), listCustomerPayments(customerId)]);
      setOrders(o);
      setPayments(p);
    } catch {
      setOrders([]);
      setPayments([]);
    }
    setOrdersLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDetail(selectedId);
      setEditing(false);
      setTxFilter("todas");
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedId, loadDetail]);

  // Não existe vínculo entre um pagamento e um pedido específico (fiado é
  // conta corrente, não fatura por fatura) — assume que o cliente sempre
  // quita a venda mais antiga primeiro (FIFO) pra decidir o que já foi pago.
  const paidOrderIds = useMemo(() => {
    const totalPaid = selected?.totalPaid ?? 0;
    const oldestFirst = orders
      .filter((o) => !o.cancelled)
      .slice()
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const paid = new Set();
    let remaining = totalPaid;
    for (const o of oldestFirst) {
      if (remaining < o.total - 0.005) break;
      paid.add(o.orderId);
      remaining -= o.total;
    }
    return paid;
  }, [orders, selected]);

  const transactions = useMemo(() => {
    const compras = orders.map((o) => ({ type: "compra", key: `o-${o.orderId}`, ...o }));
    const pagamentos = payments.map((p) => ({ type: "pagamento", key: `p-${p.id}`, ...p }));
    return [...compras, ...pagamentos].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [orders, payments]);

  const filteredTransactions = useMemo(() => {
    if (txFilter === "compras") return transactions.filter((t) => t.type === "compra" && !t.cancelled);
    if (txFilter === "pagamentos") return transactions.filter((t) => t.type === "pagamento");
    if (txFilter === "canceladas") return transactions.filter((t) => t.type === "compra" && t.cancelled);
    return transactions;
  }, [transactions, txFilter]);

  const isInactiveByRecency = useCallback(
    (c) => !c.lastOrderAt || daysSince(c.lastOrderAt) > INACTIVE_CUSTOMER_DAYS,
    [],
  );

  const counts = useMemo(() => ({
    debito: customers.filter((c) => c.balance > 0.004).length,
    credito: customers.filter((c) => c.balance < -0.004).length,
    inativos: customers.filter(isInactiveByRecency).length,
  }), [customers, isInactiveByRecency]);

  const filtered = useMemo(() => {
    let list = customers;
    if (filter === "debito") list = list.filter((c) => c.balance > 0.004);
    else if (filter === "credito") list = list.filter((c) => c.balance < -0.004);
    else if (filter === "inativos") list = list.filter(isInactiveByRecency);

    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter((c) => c.name.toLowerCase().includes(term) || (c.phone ?? "").includes(term));
    }

    const sorted = [...list];
    if (filter === "consomem") sorted.sort((a, b) => b.totalFiado - a.totalFiado);
    else sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [customers, filter, search, isInactiveByRecency]);

  const handlePay = async ({ amount, paymentMethod }) => {
    setPayError("");
    try {
      await payDebt({ customerId: selected.id, amount, paymentMethod });
      setPayModalOpen(false);
    } catch (e) {
      setPayError(e.message);
      throw e;
    }
  };

  const handleCreateCustomer = async () => {
    if (!newForm.name.trim()) {
      setCreateError("Informe o nome do cliente.");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const customer = await createCustomer(newForm);
      setSelectedId(customer.id);
      setCreatingCustomer(false);
      setNewForm(EMPTY_FORM);
    } catch (e) {
      setCreateError(e.message);
    }
    setCreating(false);
  };

  const startEditing = () => {
    setEditForm({
      name: selected.name, phone: selected.phone ?? "",
      email: selected.email ?? "", address: selected.address ?? "",
    });
    setEditError("");
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm.name.trim()) {
      setEditError("Informe o nome do cliente.");
      return;
    }
    setSavingEdit(true);
    setEditError("");
    try {
      await updateCustomer(selected.id, editForm);
      setEditing(false);
    } catch (e) {
      setEditError(e.message);
    }
    setSavingEdit(false);
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

  const handlePrint = (tx) => {
    setPrintingTx(tx);
    setTimeout(() => window.print(), 60);
  };

  return (
    <div className="pdv-fiado-view">
      <div className="pdv-fiado-customers">
        <div className="pdv-clientes-toolbar">
          <input
            className="adm-product-search"
            placeholder="🔍 Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            className="pdv-clientes-new-btn"
            title={creatingCustomer ? "Fechar formulário" : "Cadastrar novo cliente"}
            onClick={() => { setCreatingCustomer((v) => !v); setCreateError(""); }}
          >
            {creatingCustomer ? "✕" : "+ Novo"}
          </button>
        </div>

        {creatingCustomer && (
          <div className="pdv-fiado-new-form">
            {createError && <div className="adm-modal-error">⚠️ {createError}</div>}
            <input placeholder="Nome" value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} autoFocus />
            <input placeholder="Telefone (opcional)" value={newForm.phone} onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })} />
            <input placeholder="E-mail (opcional)" value={newForm.email} onChange={(e) => setNewForm({ ...newForm, email: e.target.value })} />
            <input placeholder="Endereço (opcional)" value={newForm.address} onChange={(e) => setNewForm({ ...newForm, address: e.target.value })} />
            <button className="adm-btn-new-product" onClick={handleCreateCustomer} disabled={creating}>
              {creating ? "Salvando..." : "Cadastrar cliente"}
            </button>
          </div>
        )}

        <div className="pdv-clientes-filters">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`pdv-clientes-filter-btn ${filter === f.key ? "active" : ""}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}{counts[f.key] != null ? ` (${counts[f.key]})` : ""}
            </button>
          ))}
        </div>

        {customersError && <div className="adm-modal-error">⚠️ {customersError}</div>}
        {customersLoading ? (
          <div className="adm-loading"><div className="adm-spinner" /><p>Carregando...</p></div>
        ) : filtered.length === 0 ? (
          <div className="adm-empty"><p>Nenhum cliente encontrado.</p></div>
        ) : (
          <div className="pdv-fiado-customer-list">
            {filtered.map((c) => (
              <button
                key={c.id}
                className={`pdv-fiado-customer-row ${selectedId === c.id ? "active" : ""} ${c.isActive === false ? "pdv-clientes-row-inactive" : ""}`}
                onClick={() => setSelectedId(c.id)}
              >
                <div className="pdv-clientes-row-main">
                  <span>
                    {c.name}{c.phone ? ` · ${formatPhone(c.phone)}` : ""}
                    {c.isActive === false && <span className="pdv-clientes-inactive-badge">Desativado</span>}
                  </span>
                  <span className="pdv-clientes-row-meta">
                    {formatLastOrder(c.lastOrderAt)} · consumo total {formatBRL(c.totalFiado)}
                  </span>
                </div>
                <strong className={c.balance > 0 ? "pdv-fiado-has-debt" : c.balance < 0 ? "pdv-clientes-has-credit" : ""}>
                  {formatBRL(c.balance)}
                </strong>
              </button>
            ))}
          </div>
        )}
      </div>

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
          <div className="pdv-clientes-edit-form">
            <h2 className="adm-store-section-title">Editar cliente</h2>
            {editError && <div className="adm-modal-error">⚠️ {editError}</div>}
            <div className="adm-form-field">
              <label>Nome</label>
              <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} autoFocus />
            </div>
            <div className="adm-form-field">
              <label>Telefone</label>
              <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <div className="adm-form-field">
              <label>E-mail</label>
              <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div className="adm-form-field">
              <label>Endereço</label>
              <input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
            </div>
            <div className="adm-store-form-actions">
              <button className="adm-btn-new-product" onClick={handleSaveEdit} disabled={savingEdit}>
                {savingEdit ? "Salvando..." : "Salvar"}
              </button>
              <button className="adm-btn-back" onClick={() => setEditing(false)} disabled={savingEdit}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="pdv-fiado-detail-header">
              <div>
                <h2 className="adm-store-section-title">
                  {selected.name}
                  {selected.isActive === false && <span className="pdv-clientes-inactive-badge">Desativado</span>}
                </h2>
                {selected.phone && <p className="adm-store-section-desc">{formatPhone(selected.phone)}</p>}
                {selected.email && <p className="adm-store-section-desc">{selected.email}</p>}
                {selected.address && <p className="adm-store-section-desc">{selected.address}</p>}
              </div>
              {selected.balance > 0.004 && (
                <button className="adm-btn-new-product" onClick={() => setPayModalOpen(true)}>
                  💰 Receber pagamento
                </button>
              )}
            </div>

            <div className="pdv-clientes-actions">
              <button className="pdv-clientes-secondary-btn" onClick={startEditing}>✏️ Editar</button>
              <button className="pdv-clientes-secondary-btn" onClick={handleToggleActive} disabled={togglingActive}>
                {selected.isActive === false ? "✅ Reativar" : "🚫 Desativar"}
              </button>
              <button className="pdv-clientes-secondary-btn pdv-clientes-danger-btn" onClick={() => setDeleteModalOpen(true)}>
                🗑️ Excluir
              </button>
            </div>

            {payError && <div className="adm-modal-error">⚠️ {payError}</div>}
            {statusError && <div className="adm-modal-error">⚠️ {statusError}</div>}

            <div className="pdv-clientes-stats">
              <div className="pdv-clientes-stat">
                <span>{selected.balance < 0 ? "Crédito a favor" : "Saldo devedor"}</span>
                <strong className={selected.balance < 0 ? "pdv-clientes-has-credit" : selected.balance > 0 ? "pdv-fiado-has-debt" : ""}>
                  {formatBRL(Math.abs(selected.balance))}
                </strong>
              </div>
              <div className="pdv-clientes-stat">
                <span>Consumo total</span>
                <strong>{formatBRL(selected.totalFiado)}</strong>
              </div>
              <div className="pdv-clientes-stat">
                <span>Compras</span>
                <strong>{ordersLoading ? "…" : orders.filter((o) => !o.cancelled).length}</strong>
              </div>
              <div className="pdv-clientes-stat">
                <span>Última compra</span>
                <strong>{formatLastOrder(selected.lastOrderAt)}</strong>
              </div>
            </div>

            <div>
              <h3 className="adm-store-section-title pdv-fiado-orders-title">Transações</h3>
              <div className="pdv-clientes-filters pdv-clientes-tx-filters">
                {TX_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    className={`pdv-clientes-filter-btn ${txFilter === f.key ? "active" : ""}`}
                    onClick={() => setTxFilter(f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {ordersLoading ? (
                <div className="adm-loading"><div className="adm-spinner" /><p>Carregando...</p></div>
              ) : filteredTransactions.length === 0 ? (
                <div className="adm-empty"><p>Nenhuma transação encontrada.</p></div>
              ) : (
                <div className="pdv-clientes-tx-list">
                  {filteredTransactions.map((t) => {
                    if (t.type === "pagamento") {
                      return (
                        <div key={t.key} className="pdv-clientes-tx-row">
                          <span className="pdv-sale-time">{formatDateTime(t.createdAt)}</span>
                          <span className="pdv-clientes-tx-badge pdv-clientes-tx-badge-payment">💰 Pagamento</span>
                          <span className="pdv-sale-items">{methodLabel(t.method)}</span>
                          <strong className="pdv-clientes-tx-credit">+{formatBRL(t.amount)}</strong>
                          <span />
                        </div>
                      );
                    }
                    const paid = !t.cancelled && paidOrderIds.has(t.orderId);
                    const canCancel = !t.cancelled && t.cashSessionId === currentSessionId;
                    return (
                      <div key={t.key} className={`pdv-clientes-tx-row ${t.cancelled ? "pdv-sale-cancelled" : ""}`}>
                        <span className="pdv-sale-time">{formatDateTime(t.createdAt)}</span>
                        <span className="pdv-clientes-tx-badge pdv-clientes-tx-badge-purchase">
                          🛒{t.orderNumber ? ` #${t.orderNumber}` : ""}
                        </span>
                        <span className="pdv-sale-items" title={t.itemsLabel}>{t.itemsLabel}</span>
                        <strong>{formatBRL(t.total)}</strong>
                        <div className="pdv-clientes-tx-actions">
                          <button
                            type="button"
                            className="pdv-clientes-print-btn"
                            title="Imprimir"
                            onClick={() => handlePrint(t)}
                          >
                            🖨️
                          </button>
                          {t.cancelled ? (
                            <span className="pdv-sale-cancelled-label">Cancelada</span>
                          ) : paid ? (
                            <span className="pdv-fiado-order-paid-label">Pago</span>
                          ) : canCancel ? (
                            <button
                              className="adm-btn-delete"
                              title="Cancelar venda"
                              onClick={() => onCancelSale(t)}
                              disabled={cancellingId === t.orderId}
                            >
                              {cancellingId === t.orderId ? "..." : "🗑️"}
                            </button>
                          ) : (
                            <span className="pdv-sale-locked-label" title="Só é possível cancelar vendas do caixa aberto agora">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {payModalOpen && selected && (
        <PayDebtModal customer={selected} onConfirm={handlePay} onDismiss={() => setPayModalOpen(false)} />
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

      {printingTx && (
        <div className="pdv-print-receipt">
          <h2>Dudu Bebidas</h2>
          {printingTx.orderNumber != null && <p>Pedido #{printingTx.orderNumber}</p>}
          <p>{new Date(printingTx.createdAt).toLocaleString("pt-BR")}</p>
          <p>Cliente: {selected?.name}</p>
          <hr />
          <p>{printingTx.itemsLabel}</p>
          <hr />
          <p><strong>Total: {formatBRL(printingTx.total)}</strong></p>
          <p>Forma de pagamento: Fiado</p>
        </div>
      )}
    </div>
  );
}
