import { useCallback, useEffect, useMemo, useState } from "react";
import { formatBRL, daysSince, formatLastOrder, formatPhone } from "../utils/format";
import { INACTIVE_CUSTOMER_DAYS, SPLIT_PAYMENT_METHODS } from "../constants";
import { listFiadoOrders, listCustomerPayments } from "../services/fiadoService";
import PayDebtModal from "./PayDebtModal";

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "debito", label: "Com débito" },
  { key: "credito", label: "Com crédito" },
  { key: "consomem", label: "Mais consomem" },
  { key: "inativos", label: "Inativos" },
];

function methodLabel(method) {
  const known = SPLIT_PAYMENT_METHODS.find((m) => m.value === method);
  return known ? `${known.icon} ${known.label}` : method;
}

export default function ClientesView({ customers, customersLoading, customersError, payDebt, createCustomer }) {
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payError, setPayError] = useState("");

  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

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
    setPaymentsLoading(true);
    try {
      setOrders(await listFiadoOrders(customerId));
    } catch {
      setOrders([]);
    }
    setOrdersLoading(false);
    try {
      setPayments(await listCustomerPayments(customerId));
    } catch {
      setPayments([]);
    }
    setPaymentsLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDetail(selectedId);
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

  const isInactive = useCallback(
    (c) => !c.lastOrderAt || daysSince(c.lastOrderAt) > INACTIVE_CUSTOMER_DAYS,
    [],
  );

  const counts = useMemo(() => ({
    debito: customers.filter((c) => c.balance > 0.004).length,
    credito: customers.filter((c) => c.balance < -0.004).length,
    inativos: customers.filter(isInactive).length,
  }), [customers, isInactive]);

  const filtered = useMemo(() => {
    let list = customers;
    if (filter === "debito") list = list.filter((c) => c.balance > 0.004);
    else if (filter === "credito") list = list.filter((c) => c.balance < -0.004);
    else if (filter === "inativos") list = list.filter(isInactive);

    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter((c) => c.name.toLowerCase().includes(term) || (c.phone ?? "").includes(term));
    }

    const sorted = [...list];
    if (filter === "consomem") sorted.sort((a, b) => b.totalFiado - a.totalFiado);
    else sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [customers, filter, search, isInactive]);

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
    if (!newName.trim()) {
      setCreateError("Informe o nome do cliente.");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const customer = await createCustomer({ name: newName, phone: newPhone });
      setSelectedId(customer.id);
      setCreatingCustomer(false);
      setNewName("");
      setNewPhone("");
    } catch (e) {
      setCreateError(e.message);
    }
    setCreating(false);
  };

  const purchaseCount = orders.filter((o) => !o.cancelled).length;

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
            onClick={() => { setCreatingCustomer((v) => !v); setCreateError(""); }}
          >
            {creatingCustomer ? "✕" : "+ Novo"}
          </button>
        </div>

        {creatingCustomer && (
          <div className="pdv-fiado-new-form">
            {createError && <div className="adm-modal-error">⚠️ {createError}</div>}
            <input placeholder="Nome" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
            <input placeholder="Telefone (opcional)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
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
                className={`pdv-fiado-customer-row ${selectedId === c.id ? "active" : ""}`}
                onClick={() => setSelectedId(c.id)}
              >
                <div className="pdv-clientes-row-main">
                  <span>{c.name}{c.phone ? ` · ${formatPhone(c.phone)}` : ""}</span>
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
          <div className="adm-empty"><p>Selecione um cliente pra ver o perfil.</p></div>
        ) : (
          <>
            <div className="pdv-fiado-detail-header">
              <div>
                <h2 className="adm-store-section-title">{selected.name}</h2>
                {selected.phone && <p className="adm-store-section-desc">{formatPhone(selected.phone)}</p>}
              </div>
              {selected.balance > 0.004 && (
                <button className="adm-btn-new-product" onClick={() => setPayModalOpen(true)}>
                  💰 Receber pagamento
                </button>
              )}
            </div>

            {payError && <div className="adm-modal-error">⚠️ {payError}</div>}

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
                <strong>{ordersLoading ? "…" : purchaseCount}</strong>
              </div>
              <div className="pdv-clientes-stat">
                <span>Última compra</span>
                <strong>{formatLastOrder(selected.lastOrderAt)}</strong>
              </div>
            </div>

            <div className="pdv-clientes-history-cols">
              <div className="pdv-clientes-history-col">
                <h3 className="adm-store-section-title pdv-fiado-orders-title">Vendas fiado</h3>
                {ordersLoading ? (
                  <div className="adm-loading"><div className="adm-spinner" /><p>Carregando...</p></div>
                ) : orders.length === 0 ? (
                  <div className="adm-empty"><p>Nenhuma venda fiado ainda.</p></div>
                ) : (
                  <div className="pdv-fiado-orders-list">
                    {orders.map((o) => {
                      const paid = !o.cancelled && paidOrderIds.has(o.orderId);
                      return (
                        <div
                          key={o.orderId}
                          className={`pdv-fiado-order-row ${o.cancelled ? "pdv-sale-cancelled" : ""} ${paid ? "pdv-fiado-order-paid" : ""}`}
                        >
                          <span className="pdv-sale-time">
                            {new Date(o.createdAt).toLocaleDateString("pt-BR")}
                          </span>
                          <span className="pdv-sale-items" title={o.itemsLabel}>
                            {o.orderNumber ? `#${o.orderNumber} · ` : ""}{o.itemsLabel}
                          </span>
                          <strong>{formatBRL(o.total)}</strong>
                          {o.cancelled && <span className="pdv-sale-cancelled-label">Cancelada</span>}
                          {paid && <span className="pdv-fiado-order-paid-label">Pago</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pdv-clientes-history-col">
                <h3 className="adm-store-section-title pdv-fiado-orders-title">Pagamentos recebidos</h3>
                {paymentsLoading ? (
                  <div className="adm-loading"><div className="adm-spinner" /><p>Carregando...</p></div>
                ) : payments.length === 0 ? (
                  <div className="adm-empty"><p>Nenhum pagamento recebido ainda.</p></div>
                ) : (
                  <div className="pdv-fiado-orders-list">
                    {payments.map((p) => (
                      <div key={p.id} className="pdv-clientes-payment-row">
                        <span className="pdv-sale-time">
                          {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                        </span>
                        <span>{methodLabel(p.method)}</span>
                        <strong>{formatBRL(p.amount)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {payModalOpen && selected && (
        <PayDebtModal customer={selected} onConfirm={handlePay} onDismiss={() => setPayModalOpen(false)} />
      )}
    </div>
  );
}
