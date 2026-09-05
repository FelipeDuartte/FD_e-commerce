import { useState } from "react";

const EMPTY_FORM = { name: "", phone: "", email: "", address: "" };

export default function CustomerCreateForm({ createCustomer, onCreated }) {
  const [newForm, setNewForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const handleCreateCustomer = async () => {
    if (!newForm.name.trim()) {
      setCreateError("Informe o nome do cliente.");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const customer = await createCustomer(newForm);
      onCreated(customer);
      setNewForm(EMPTY_FORM);
    } catch (e) {
      setCreateError(e.message);
    }
    setCreating(false);
  };

  return (
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
  );
}
