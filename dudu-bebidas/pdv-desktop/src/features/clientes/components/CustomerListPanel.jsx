import { useMemo, useState, useCallback } from "react";
import { formatBRL, daysSince, formatLastOrder, formatPhone } from "../../../shared/utils/format";
import { INACTIVE_CUSTOMER_DAYS } from "../constants";
import CustomerCreateForm from "./CustomerCreateForm";

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "debito", label: "Com débito" },
  { key: "credito", label: "Com crédito" },
  { key: "consomem", label: "Mais consomem" },
  { key: "inativos", label: "Inativos" },
];

export default function CustomerListPanel({
  customers, customersLoading, customersError, selectedId, onSelect,
  creatingCustomer, onToggleCreating, createCustomer, onCustomerCreated,
}) {
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");

  // Cliente desativado manualmente entra direto em "Inativos", além de
  // quem só está sem comprar há muito tempo (inatividade por recência).
  const isInactive = useCallback(
    (c) => c.isActive === false || !c.lastOrderAt || daysSince(c.lastOrderAt) > INACTIVE_CUSTOMER_DAYS,
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

  return (
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
          onClick={onToggleCreating}
        >
          {creatingCustomer ? "✕" : "+ Novo"}
        </button>
      </div>

      {creatingCustomer && (
        <CustomerCreateForm createCustomer={createCustomer} onCreated={onCustomerCreated} />
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
              onClick={() => onSelect(c.id)}
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
  );
}
