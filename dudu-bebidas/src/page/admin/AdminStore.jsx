import { useState, useEffect, useCallback } from "react";
import "./AdminStore.css";
import { formatBRL } from "./adminUtils";
import {
  listCategories,
  createCategory,
  updateCategory,
  toggleCategory,
  deleteCategory,
  listDeliveryZones,
  createDeliveryZone,
  updateDeliveryZone,
  toggleDeliveryZone,
  deleteDeliveryZone,
  getStoreConfig,
  updateStoreConfig,
  listStoreHours,
  upsertStoreHours,
} from "./services/adminStoreService";
import {
  listTeam,
  promoteToAdmin,
  demoteFromAdmin,
  getCurrentUserId,
} from "./services/adminTeamService";

const DAYS = [
  { key: 0, label: "Domingo" },
  { key: 1, label: "Segunda-feira" },
  { key: 2, label: "Terça-feira" },
  { key: 3, label: "Quarta-feira" },
  { key: 4, label: "Quinta-feira" },
  { key: 5, label: "Sexta-feira" },
  { key: 6, label: "Sábado" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SEÇÃO: CATEGORIAS
// ═══════════════════════════════════════════════════════════════════════════════
function CategoriesSection() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [busy, setBusy]             = useState(false);
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState("");
  const [newName, setNewName]       = useState("");
  const [editId, setEditId]         = useState(null);
  const [editName, setEditName]     = useState("");

  // ── Recarrega lista do banco ─────────────────────────────────
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listCategories();
      setCategories(data);
      setError("");
    } catch (e) {
      console.error("[CategoriesSection] reload error:", e);
      setError(e.message || "Erro ao carregar categorias.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // ── Executora genérica: roda fn, recarrega, exibe feedback ───
  const run = useCallback(async (successMsg, fn) => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await fn();
      await reload();
      setSuccess(successMsg);
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      console.error("[CategoriesSection] run error:", e);
      setError(e.message || "Erro inesperado. Verifique o console (F12).");
    }
    setBusy(false);
  }, [reload]);

  const handleAdd = () => {
    if (!newName.trim()) return;
    run("Categoria criada!", () => createCategory(newName).then(() => setNewName("")));
  };

  const handleSaveEdit = (cat) => {
    if (!editName.trim()) return;
    run("Categoria atualizada!", () =>
      updateCategory(cat.id, editName).then(() => setEditId(null))
    );
  };

  const handleToggle = (cat) =>
    run(cat.is_active ? "Categoria desativada." : "Categoria ativada.", () =>
      toggleCategory(cat.id, !cat.is_active)
    );

  const handleDelete = (cat) => {
    if (!window.confirm(`Excluir "${cat.name}"?`)) return;
    run("Categoria excluída.", () => deleteCategory(cat.id, cat.name));
  };

  return (
    <div className="adm-store-section">
      <div className="adm-store-section-header">
        <h2 className="adm-store-section-title">Categorias</h2>
        <p className="adm-store-section-desc">
          Gerencie as categorias de produtos da loja.
        </p>
      </div>

      {error   && <div className="adm-modal-error">⚠️ {error}</div>}
      {success && <div className="adm-store-success">✅ {success}</div>}

      {/* Adicionar */}
      <div className="adm-store-add-row">
        <input
          className="adm-product-search"
          placeholder="Nome da nova categoria…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          disabled={busy}
        />
        <button
          className="adm-btn-new-product"
          onClick={handleAdd}
          disabled={busy || !newName.trim()}
        >
          {busy ? "Aguarde…" : "+ Adicionar"}
        </button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="adm-loading">
          <div className="adm-spinner" />
          <p>Carregando categorias…</p>
        </div>
      ) : categories.length === 0 ? (
        <div className="adm-empty"><p>Nenhuma categoria cadastrada.</p></div>
      ) : (
        <div className="adm-product-table-wrap">
          <table className="adm-product-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id} className={!cat.is_active ? "adm-row-inactive" : ""}>
                  <td>
                    {editId === cat.id ? (
                      <div className="adm-store-inline-edit">
                        <input
                          className="adm-store-inline-input"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")  handleSaveEdit(cat);
                            if (e.key === "Escape") { setEditId(null); setEditName(""); }
                          }}
                          disabled={busy}
                          autoFocus
                        />
                        <button
                          className="adm-btn-save-inline"
                          onClick={() => handleSaveEdit(cat)}
                          disabled={busy || !editName.trim()}
                        >✓</button>
                        <button
                          className="adm-btn-cancel-inline"
                          onClick={() => { setEditId(null); setEditName(""); }}
                          disabled={busy}
                        >✕</button>
                      </div>
                    ) : (
                      <span className="adm-cat-badge">{cat.name}</span>
                    )}
                  </td>
                  <td>
                    <span className={`adm-status-pill ${cat.is_active ? "active" : "inactive"}`}>
                      {cat.is_active ? "✅ Ativa" : "🚫 Inativa"}
                    </span>
                  </td>
                  <td className="adm-td-actions">
                    {editId !== cat.id && (
                      <button
                        className="adm-btn-edit"
                        onClick={() => { setEditId(cat.id); setEditName(cat.name); }}
                        disabled={busy}
                      >✏️ Editar</button>
                    )}
                    <button
                      className={`adm-btn-toggle ${cat.is_active ? "deactivate" : "activate"}`}
                      onClick={() => handleToggle(cat)}
                      disabled={busy}
                    >{cat.is_active ? "🚫 Desativar" : "✅ Ativar"}</button>
                    <button
                      className="adm-btn-delete"
                      onClick={() => handleDelete(cat)}
                      disabled={busy}
                    >🗑️ Excluir</button>
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

// ═══════════════════════════════════════════════════════════════════════════════
// SEÇÃO: TAXA POR BAIRRO
// ═══════════════════════════════════════════════════════════════════════════════
const EMPTY_ZONE = { nome: "", frete: "", is_retirada: false };

function DeliveryZonesSection() {
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

  useEffect(() => { fetchZones(); }, [fetchZones]);

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

// ═══════════════════════════════════════════════════════════════════════════════
// SEÇÃO: HORÁRIO DE FUNCIONAMENTO
// ═══════════════════════════════════════════════════════════════════════════════
const DEFAULT_HOURS = DAYS.map((d) => ({
  day_of_week: d.key,
  is_open:     d.key !== 0 && d.key !== 1,
  open_time:   "09:00",
  close_time:  d.key === 0 || d.key === 6 ? "19:00" : "17:30",
}));

function StoreHoursSection() {
  const [config, setConfig]   = useState(null);
  const [hours, setHours]     = useState(DEFAULT_HOURS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [cfg, hrs] = await Promise.all([getStoreConfig(), listStoreHours()]);
        if (cancelled) return;
        setConfig(cfg);
        if (hrs.length > 0) {
          const byDay = Object.fromEntries(hrs.map((h) => [h.day_of_week, h]));
          setHours(DAYS.map((d) => byDay[d.key]
            ? { day_of_week: d.key, is_open: byDay[d.key].is_open, open_time: (byDay[d.key].open_time ?? "09:00").slice(0, 5), close_time: (byDay[d.key].close_time ?? "19:00").slice(0, 5) }
            : DEFAULT_HOURS.find((dh) => dh.day_of_week === d.key)
          ));
        }
      } catch (e) { if (!cancelled) setError(e.message); }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const updateRow = (dayKey, field, value) =>
    setHours((prev) => prev.map((h) => h.day_of_week === dayKey ? { ...h, [field]: value } : h));

  const handleSave = async () => {
    setSaving(true); setError(""); setSuccess("");
    try {
      await Promise.all([
        upsertStoreHours(hours),
        config !== null ? updateStoreConfig({ close_on_holidays: config.close_on_holidays }) : Promise.resolve(),
      ]);
      setSuccess("Horários salvos com sucesso!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) { setError(e.message); }
    setSaving(false);
  };

  if (loading) return (
    <div className="adm-store-section">
      <div className="adm-loading"><div className="adm-spinner" /><p>Carregando horários…</p></div>
    </div>
  );

  return (
    <div className="adm-store-section">
      <div className="adm-store-section-header">
        <h2 className="adm-store-section-title">Horário de Funcionamento</h2>
        <p className="adm-store-section-desc">Defina abertura e fechamento por dia da semana.</p>
      </div>

      {error   && <div className="adm-modal-error">⚠️ {error}</div>}
      {success && <div className="adm-store-success">✅ {success}</div>}

      {config !== null && (
        <div className="adm-store-global-flags">
          <label className="adm-store-flag-row">
            <div className="adm-store-flag-info">
              <span className="adm-store-flag-label">🗓️ Fechar em feriados</span>
              <span className="adm-store-flag-desc">Fecha automaticamente em feriados nacionais.</span>
            </div>
            <div
              className={`adm-store-toggle ${config.close_on_holidays ? "on" : "off"}`}
              onClick={() => setConfig((p) => ({ ...p, close_on_holidays: !p.close_on_holidays }))}
              role="switch" aria-checked={config.close_on_holidays} tabIndex={0}
              onKeyDown={(e) => e.key === " " && setConfig((p) => ({ ...p, close_on_holidays: !p.close_on_holidays }))}
            >
              <span className="adm-store-toggle-thumb" />
            </div>
          </label>
        </div>
      )}

      <div className="adm-store-hours-grid">
        <div className="adm-store-hours-header">
          <span>Dia</span><span>Aberto</span><span>Abre às</span><span>Fecha às</span>
        </div>
        {DAYS.map((day) => {
          const row = hours.find((h) => h.day_of_week === day.key);
          if (!row) return null;
          return (
            <div key={day.key} className={`adm-store-hours-row ${!row.is_open ? "closed" : ""}`}>
              <span className="adm-store-day-label">{day.label}</span>
              <div
                className={`adm-store-toggle ${row.is_open ? "on" : "off"}`}
                onClick={() => updateRow(day.key, "is_open", !row.is_open)}
                role="switch" aria-checked={row.is_open} tabIndex={0}
                onKeyDown={(e) => e.key === " " && updateRow(day.key, "is_open", !row.is_open)}
              >
                <span className="adm-store-toggle-thumb" />
              </div>
              <input type="time" className="adm-store-time-input" value={row.open_time}
                onChange={(e) => updateRow(day.key, "open_time", e.target.value)} disabled={!row.is_open} />
              <input type="time" className="adm-store-time-input" value={row.close_time}
                onChange={(e) => updateRow(day.key, "close_time", e.target.value)} disabled={!row.is_open} />
            </div>
          );
        })}
      </div>

      <div className="adm-store-hours-save">
        <button className="adm-btn-new-product" onClick={handleSave} disabled={saving}>
          {saving ? "Salvando…" : "💾 Salvar Horários"}
        </button>
        <p className="adm-store-hours-hint">Alterações entram em vigor imediatamente.</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEÇÃO: EQUIPE (admins da loja)
// ═══════════════════════════════════════════════════════════════════════════════
function TeamSection() {
  const [team, setTeam]         = useState([]);
  const [myId, setMyId]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [newEmail, setNewEmail] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [teamData, uid] = await Promise.all([listTeam(), getCurrentUserId()]);
      setTeam(teamData);
      setMyId(uid);
      setError("");
    } catch (e) {
      console.error("[TeamSection] reload error:", e);
      setError(e.message || "Erro ao carregar a equipe.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const run = useCallback(async (successMsg, fn) => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await fn();
      await reload();
      setSuccess(successMsg);
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      console.error("[TeamSection] run error:", e);
      setError(e.message || "Erro inesperado. Verifique o console (F12).");
    }
    setBusy(false);
  }, [reload]);

  const handleAdd = () => {
    if (!newEmail.trim()) return;
    run(`${newEmail.trim()} agora é admin desta loja!`, () =>
      promoteToAdmin(newEmail).then(() => setNewEmail(""))
    );
  };

  const handleRemove = (member) => {
    if (!window.confirm(`Remover "${member.email}" da equipe de admins?`)) return;
    run("Removido(a) da equipe.", () => demoteFromAdmin(member.id));
  };

  return (
    <div className="adm-store-section">
      <div className="adm-store-section-header">
        <h2 className="adm-store-section-title">Equipe</h2>
        <p className="adm-store-section-desc">
          Quem tem acesso ao painel admin desta loja. A pessoa precisa já ter
          uma conta criada no site (cadastro normal) antes de ser adicionada aqui.
        </p>
      </div>

      {error   && <div className="adm-modal-error">⚠️ {error}</div>}
      {success && <div className="adm-store-success">✅ {success}</div>}

      <div className="adm-store-add-row">
        <input
          className="adm-product-search"
          type="email"
          placeholder="E-mail da pessoa (já cadastrada no site)…"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          disabled={busy}
        />
        <button
          className="adm-btn-new-product"
          onClick={handleAdd}
          disabled={busy || !newEmail.trim()}
        >
          {busy ? "Aguarde…" : "+ Adicionar admin"}
        </button>
      </div>

      {loading ? (
        <div className="adm-loading">
          <div className="adm-spinner" />
          <p>Carregando equipe…</p>
        </div>
      ) : team.length === 0 ? (
        <div className="adm-empty"><p>Nenhum admin cadastrado ainda.</p></div>
      ) : (
        <div className="adm-product-table-wrap">
          <table className="adm-product-table">
            <thead>
              <tr>
                <th>E-mail</th>
                <th>Admin desde</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {team.map((member) => (
                <tr key={member.id}>
                  <td>
                    <span className="adm-cat-badge">
                      {member.email}
                      {member.id === myId && " (você)"}
                    </span>
                  </td>
                  <td>
                    {member.created_at
                      ? new Date(member.created_at).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td className="adm-td-actions">
                    <button
                      className="adm-btn-delete"
                      onClick={() => handleRemove(member)}
                      disabled={busy || member.id === myId}
                      title={member.id === myId ? "Peça para outro admin remover você" : ""}
                    >🗑️ Remover</button>
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

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
const STORE_TABS = [
  { key: "categorias", label: "🏷️ Categorias" },
  { key: "bairros",    label: "🗺️ Taxa por Bairro" },
  { key: "horarios",   label: "🕐 Horários" },
  { key: "equipe",     label: "👥 Equipe" },
];

export default function AdminStore() {
  const [storeTab, setStoreTab] = useState("categorias");
  return (
    <>
      <div className="adm-title-row">
        <div>
          <h1 className="adm-title">Configurações da Loja</h1>
          <p className="adm-subtitle">Categorias, taxas de entrega e horários.</p>
        </div>
      </div>
      <div className="adm-subtabs">
        {STORE_TABS.map(({ key, label }) => (
          <button
            key={key}
            className={`adm-subtab ${storeTab === key ? "adm-subtab-active" : ""}`}
            onClick={() => setStoreTab(key)}
          >{label}</button>
        ))}
      </div>
      {storeTab === "categorias" && <CategoriesSection />}
      {storeTab === "bairros"    && <DeliveryZonesSection />}
      {storeTab === "horarios"   && <StoreHoursSection />}
      {storeTab === "equipe"     && <TeamSection />}
    </>
  );
}