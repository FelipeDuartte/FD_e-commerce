import { useState } from "react";

export default function CustomerEditForm({ customer, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: customer.name, phone: customer.phone ?? "",
    email: customer.email ?? "", address: customer.address ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError("Informe o nome do cliente.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  return (
    <div className="pdv-clientes-edit-form">
      <h2 className="adm-store-section-title">Editar cliente</h2>
      {error && <div className="adm-modal-error">⚠️ {error}</div>}
      <div className="adm-form-field">
        <label>Nome</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
      </div>
      <div className="adm-form-field">
        <label>Telefone</label>
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <div className="adm-form-field">
        <label>E-mail</label>
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <div className="adm-form-field">
        <label>Endereço</label>
        <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </div>
      <div className="adm-store-form-actions">
        <button className="adm-btn-new-product" onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button className="adm-btn-back" onClick={onCancel} disabled={saving}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
