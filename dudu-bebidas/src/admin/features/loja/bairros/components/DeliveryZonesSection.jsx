import { useState, useEffect, useCallback } from "react";
import { formatBRL } from "../../../../shared/adminUtils";
import {
  listDeliveryZones,
  createDeliveryZone,
  updateDeliveryZone,
  toggleDeliveryZone,
  deleteDeliveryZone,
} from "../../services/adminStoreService";
import { EMPTY_ZONE } from "../../constants";

export default function DeliveryZonesSection() {
  const [zones, setZones]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(EMPTY_ZONE);
  const [saving, setSaving]     = useState(false);
  const [editId, setEditId]     = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_ZONE);
  const [editSaving, setEditSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const flash = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(""), 3000); };

  const fetchZones = useCallback(async () => {
    setLoading(true);
    try { setZones(await listDeliveryZones()); setError(""); }
    catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { fetchZones(); }, 0);
    return () => clearTimeout(timer);
  }, [fetchZones]);

  const handleAdd = async (e) => {
    e?.preventDefault();
    setSaving(true); setError("");
    try {
      const zone = await createDeliveryZone(form);
      setZones((prev) => [...prev, zone]);
      setForm(EMPTY_ZONE); setShowForm(false);
      flash("Bairro adicionado!");
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  const handleSaveEdit = async (id) => {
    setEditSaving(true); setError("");
    try {
      const updated = await updateDeliveryZone(id, editForm);
      setZones((prev) => prev.map((z) => (z.id === id ? updated : z)));
      setEditId(null);
      flash("Bairro atualizado!");
    } catch (e) { setError(e.message); }
    setEditSaving(false);
  };

  const handleToggle = async (zone) => {
    setTogglingId(zone.id); setError("");
    try {
      const updated = await toggleDeliveryZone(zone.id, !zone.is_active);
      setZones((prev) => prev.map((z) => (z.id === zone.id ? updated : z)));
    } catch (e) { setError(e.message); }
    setTogglingId(null);
  };

  const handleDelete = async (zone) => {
    if (!window.confirm(`Excluir "${zone.nome}"?`)) return;
    setDeletingId(zone.id); setError("");
    try {
      await deleteDeliveryZone(zone.id);
      setZones((prev) => prev.filter((z) => z.id !== zone.id));
      flash("Bairro excluído.");
    } catch (e) { setError(e.message); }
    setDeletingId(null);
  };

  const onFormChange = ({ target: { name, value, type, checked } }) =>
    setForm((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));

  const onEditChange = ({ target: { name, value, type, checked } }) =>
    setEditForm((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));

  return (
    <div className="adm-store-section">
      <div className="adm-store-section-header">
        <h2 className="adm-store-section-title">Taxa por Bairro</h2>
        <p className="adm-store-section-desc">Configure bairros atendidos e taxas de entrega.</p>
      </div>

      {error   && <div className="adm-modal-error">⚠️ {error}</div>}
      {success && <div className="adm-store-success">✅ {success}</div>}

      {!showForm && (
        <div className="adm-store-add-row">
          <button className="adm-btn-new-product" onClick={() => { setShowForm(true); setError(""); }}>
            + Novo Bairro
          </button>
        </div>
      )}

      {showForm && (
        <div className="adm-store-zone-form">
          <h3 className="adm-store-form-title">Novo Bairro</h3>
          <div className="adm-form-row">
            <div className="adm-form-field">
              <label>Nome do bairro</label>
              <input name="nome" value={form.nome} onChange={onFormChange} placeholder="Ex: Centro…" />
            </div>
            <div className="adm-form-field">
              <label>Taxa (R$)</label>
              <input name="frete" type="number" min="0" step="0.01" value={form.frete} onChange={onFormChange} placeholder="0.00" />
            </div>
          </div>
          <div className="adm-form-checks">
            <label className="adm-form-check">
              <input type="checkbox" name="is_retirada" checked={form.is_retirada} onChange={onFormChange} />
              Retirada na loja (frete = 0)
            </label>
          </div>
          <div className="adm-store-form-actions">
            <button className="adm-btn-new-product" onClick={handleAdd} disabled={saving || !form.nome.trim()}>
              {saving ? "Salvando…" : "Salvar"}
            </button>
            <button className="adm-btn-back" onClick={() => { setShowForm(false); setForm(EMPTY_ZONE); }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="adm-loading"><div className="adm-spinner" /><p>Carregando…</p></div>
      ) : zones.length === 0 ? (
        <div className="adm-empty"><p>Nenhum bairro cadastrado.</p></div>
      ) : (
        <div className="adm-product-table-wrap">
          <table className="adm-product-table">
            <thead>
              <tr>{["Bairro", "Taxa", "Tipo", "Status", "Ações"].map((h) => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {zones.map((zone) => (
                <tr key={zone.id} className={!zone.is_active ? "adm-row-inactive" : ""}>
                  <td>
                    {editId === zone.id
                      ? <input className="adm-store-inline-input" name="nome" value={editForm.nome} onChange={onEditChange} autoFocus />
                      : <span className="adm-td-name">{zone.nome}</span>}
                  </td>
                  <td>
                    {editId === zone.id
                      ? <input className="adm-store-inline-input adm-store-inline-frete" name="frete" type="number" min="0" step="0.01" value={editForm.frete} onChange={onEditChange} />
                      : <span className={`adm-store-frete-badge ${zone.frete === 0 ? "gratis" : ""}`}>{zone.frete === 0 ? "GRÁTIS" : formatBRL(zone.frete)}</span>}
                  </td>
                  <td>
                    {editId === zone.id
                      ? <label className="adm-form-check" style={{ fontSize: 12 }}><input type="checkbox" name="is_retirada" checked={editForm.is_retirada} onChange={onEditChange} /> Retirada</label>
                      : <span className="adm-cat-badge">{zone.is_retirada ? "🏪 Retirada" : "🛵 Entrega"}</span>}
                  </td>
                  <td>
                    <span className={`adm-status-pill ${zone.is_active ? "active" : "inactive"}`}>
                      {zone.is_active ? "✅ Ativo" : "🚫 Inativo"}
                    </span>
                  </td>
                  <td className="adm-td-actions">
                    {editId === zone.id ? (
                      <>
                        <button className="adm-btn-save-inline" onClick={() => handleSaveEdit(zone.id)} disabled={editSaving}>✓ Salvar</button>
                        <button className="adm-btn-cancel-inline" onClick={() => setEditId(null)} disabled={editSaving}>✕</button>
                      </>
                    ) : (
                      <>
                        <button className="adm-btn-edit" onClick={() => { setEditId(zone.id); setEditForm({ nome: zone.nome, frete: zone.frete, is_retirada: zone.is_retirada }); }}>✏️ Editar</button>
                        <button className={`adm-btn-toggle ${zone.is_active ? "deactivate" : "activate"}`} onClick={() => handleToggle(zone)} disabled={togglingId === zone.id}>
                          {togglingId === zone.id ? "…" : zone.is_active ? "🚫 Desativar" : "✅ Ativar"}
                        </button>
                        <button className="adm-btn-delete" onClick={() => handleDelete(zone)} disabled={deletingId === zone.id}>
                          {deletingId === zone.id ? "…" : "🗑️"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
