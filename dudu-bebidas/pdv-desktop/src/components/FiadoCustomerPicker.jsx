import { useState } from "react";
import { formatBRL } from "../utils/format";

// Aparece dentro do carrinho quando a forma de pagamento é "Fiado" — busca
// um cliente existente ou cadastra um novo na hora, sem sair da venda.
export default function FiadoCustomerPicker({ customers, customersLoading, selectedCustomer, onSelectCustomer, onCreateCustomer }) {
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (selectedCustomer) {
    return (
      <div className="pdv-fiado-selected">
        <span>👤 {selectedCustomer.name}{selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ""}</span>
        <span className="pdv-fiado-selected-balance">Saldo atual: {formatBRL(selectedCustomer.balance)}</span>
        <button type="button" className="pdv-fiado-change-btn" onClick={() => onSelectCustomer(null)}>
          Trocar cliente
        </button>
      </div>
    );
  }

  // Cliente desativado não pode ser escolhido pra fiado novo — continua
  // existindo (histórico intacto), só não aparece aqui.
  const active = customers.filter((c) => c.isActive !== false);
  const term = search.trim().toLowerCase();
  const filtered = term
    ? active.filter((c) => c.name.toLowerCase().includes(term) || (c.phone ?? "").includes(term))
    : active;

  const handleCreate = async () => {
    if (!newName.trim()) {
      setError("Informe o nome do cliente.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const customer = await onCreateCustomer({ name: newName, phone: newPhone });
      onSelectCustomer(customer);
      setCreating(false);
      setNewName("");
      setNewPhone("");
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  return (
    <div className="pdv-fiado-picker">
      {!creating ? (
        <>
          <input
            className="pdv-fiado-search"
            placeholder="🔍 Buscar cliente por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {customersLoading ? (
            <p className="pdv-fiado-hint">Carregando clientes...</p>
          ) : (
            <div className="pdv-fiado-list">
              {filtered.map((c) => (
                <button key={c.id} type="button" className="pdv-fiado-option" onClick={() => onSelectCustomer(c)}>
                  <span>{c.name}{c.phone ? ` · ${c.phone}` : ""}</span>
                  <span className="pdv-fiado-option-balance">{formatBRL(c.balance)}</span>
                </button>
              ))}
              {filtered.length === 0 && <p className="pdv-fiado-hint">Nenhum cliente encontrado.</p>}
            </div>
          )}
          <button
            type="button"
            className="pdv-split-add-btn"
            onClick={() => { setCreating(true); setNewName(search); }}
          >
            + Novo cliente
          </button>
        </>
      ) : (
        <div className="pdv-fiado-new-form">
          {error && <div className="adm-modal-error">⚠️ {error}</div>}
          <input placeholder="Nome" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          <input placeholder="Telefone (opcional)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          <div className="pdv-fiado-new-actions">
            <button type="button" className="adm-btn-new-product" onClick={handleCreate} disabled={saving}>
              {saving ? "Salvando..." : "Cadastrar e selecionar"}
            </button>
            <button type="button" className="adm-btn-back" onClick={() => setCreating(false)} disabled={saving}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
