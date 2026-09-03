import { useState, useEffect, useCallback } from "react";
import {
  listCategories,
  createCategory,
  updateCategory,
  toggleCategory,
  deleteCategory,
} from "../services/categoryService";

export default function CategoriesSection() {
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

  useEffect(() => {
    const timer = setTimeout(() => { reload(); }, 0);
    return () => clearTimeout(timer);
  }, [reload]);

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
