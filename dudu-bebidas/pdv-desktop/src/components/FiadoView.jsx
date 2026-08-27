import { useCallback, useEffect, useMemo, useState } from "react";
import { formatBRL } from "../utils/format";
import { listFiadoOrders } from "../services/fiadoService";
import PayDebtModal from "./PayDebtModal";

export default function FiadoView({ customers, customersLoading, customersError, payDebt }) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payError, setPayError] = useState("");

  // Deriva do array atualizado em vez de guardar o objeto — assim o saldo
  // exibido sempre reflete o último pagamento, sem precisar sincronizar.
  const selected = customers.find((c) => c.id === selectedId) ?? null;

  const loadOrders = useCallback(async (customerId) => {
    if (!customerId) {
      setOrders([]);
      return;
    }
    setOrdersLoading(true);
    try {
      setOrders(await listFiadoOrders(customerId));
    } catch {
      setOrders([]);
    }
    setOrdersLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadOrders(selectedId);
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedId, loadOrders]);

  // Não existe vínculo entre um pagamento e uma venda específica — fiado é
  // uma conta corrente, não fatura por fatura. Pra decidir o que já foi
  // "pago", assume que o cliente sempre quita a venda mais antiga primeiro
  // (FIFO): soma o total pago da conta e vai marcando as vendas da mais
  // velha pra mais nova até esse valor acabar. Canceladas nunca contam.
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

  const term = search.trim().toLowerCase();
  const filtered = customers.filter(
    (c) => !term || c.name.toLowerCase().includes(term) || (c.phone ?? "").includes(term),
  );

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

  return (
    <div className="pdv-fiado-view">
      <div className="pdv-fiado-customers">
        <input
          className="adm-product-search"
          placeholder="🔍 Buscar cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {customersError && <div className="adm-modal-error">⚠️ {customersError}</div>}
        {customersLoading ? (
          <div className="adm-loading"><div className="adm-spinner" /><p>Carregando...</p></div>
        ) : filtered.length === 0 ? (
          <div className="adm-empty"><p>Nenhum cliente cadastrado ainda.</p></div>
        ) : (
          <div className="pdv-fiado-customer-list">
            {filtered.map((c) => (
              <button
                key={c.id}
                className={`pdv-fiado-customer-row ${selectedId === c.id ? "active" : ""}`}
                onClick={() => setSelectedId(c.id)}
              >
                <span>{c.name}{c.phone ? ` · ${c.phone}` : ""}</span>
                <strong className={c.balance > 0 ? "pdv-fiado-has-debt" : ""}>{formatBRL(c.balance)}</strong>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="pdv-fiado-detail">
        {!selected ? (
          <div className="adm-empty"><p>Selecione um cliente pra ver o histórico.</p></div>
        ) : (
          <>
            <div className="pdv-fiado-detail-header">
              <div>
                <h2 className="adm-store-section-title">{selected.name}</h2>
                {selected.phone && <p className="adm-store-section-desc">{selected.phone}</p>}
              </div>
              <div className="pdv-fiado-detail-balance">
                <span>Saldo devedor</span>
                <strong>{formatBRL(selected.balance)}</strong>
              </div>
            </div>

            {payError && <div className="adm-modal-error">⚠️ {payError}</div>}

            <button className="adm-btn-new-product" onClick={() => setPayModalOpen(true)}>
              💰 Receber pagamento
            </button>

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
                      <span className="pdv-sale-items" title={o.itemsLabel}>{o.itemsLabel}</span>
                      <strong>{formatBRL(o.total)}</strong>
                      {o.cancelled && <span className="pdv-sale-cancelled-label">Cancelada</span>}
                      {paid && <span className="pdv-fiado-order-paid-label">Pago</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {payModalOpen && selected && (
        <PayDebtModal customer={selected} onConfirm={handlePay} onDismiss={() => setPayModalOpen(false)} />
      )}
    </div>
  );
}
