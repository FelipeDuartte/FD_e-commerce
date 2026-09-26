import { useState, useEffect, useCallback } from "react";
import {
  listCouriers,
  createCourier,
  setCourierActive,
} from "../services/entregadoresService";

const EMPTY_FORM = { name: "", phone: "", email: "", password: "" };

export default function EntregadoresSection() {
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [form, setForm]         = useState(EMPTY_FORM);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setCouriers(await listCouriers());
      setError("");
    } catch (e) {
      console.error("[EntregadoresSection] reload error:", e);
      setError(e.message || "Erro ao carregar os entregadores.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { reload(); }, 0);
    return () => clearTimeout(timer);
  }, [reload]);

  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleAdd = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await createCourier(form);
      setForm(EMPTY_FORM);
      await reload();
      setSuccess(`${form.name.trim()} cadastrado(a) como entregador!`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      console.error("[EntregadoresSection] create error:", e);
      setError(e.message || "Erro inesperado ao cadastrar.");
    }
    setBusy(false);
  };

  const handleToggleActive = async (courier) => {
    setBusy(true);
    setError("");
    try {
      await setCourierActive(courier.id, !courier.is_active);
      await reload();
    } catch (e) {
      console.error("[EntregadoresSection] toggle error:", e);
      setError(e.message || "Erro ao atualizar entregador.");
    }
    setBusy(false);
  };

  return (
    <div className="adm-store-section">
      <div className="adm-store-section-header">
        <h2 className="adm-store-section-title">Entregadores</h2>
        <p className="adm-store-section-desc">
          Cadastre o login de cada entregador (e-mail e senha de trabalho —
          não precisa ser a mesma conta pessoal dele). Ele acessa pelo
          celular em <strong>/entregador</strong> e vê só as entregas
          atribuídas a ele.
        </p>
      </div>

      {error   && <div className="adm-modal-error">⚠️ {error}</div>}
      {success && <div className="adm-store-success">✅ {success}</div>}

      <div className="adm-form-row">
        <div className="adm-form-field">
          <label>Nome</label>
          <input value={form.name} onChange={handleChange("name")} disabled={busy} />
        </div>
        <div className="adm-form-field">
          <label>Telefone</label>
          <input value={form.phone} onChange={handleChange("phone")} disabled={busy} />
        </div>
      </div>
      <div className="adm-form-row">
        <div className="adm-form-field">
          <label>E-mail de login</label>
          <input type="email" value={form.email} onChange={handleChange("email")} disabled={busy} />
        </div>
        <div className="adm-form-field">
          <label>Senha</label>
          <input type="password" value={form.password} onChange={handleChange("password")} disabled={busy} />
        </div>
      </div>

      <div className="adm-store-add-row">
        <button
          className="adm-btn-new-product"
          onClick={handleAdd}
          disabled={busy || !form.name.trim() || !form.email.trim() || !form.password}
        >
          {busy ? "Aguarde…" : "+ Cadastrar entregador"}
        </button>
      </div>

      {loading ? (
        <div className="adm-loading">
          <div className="adm-spinner" />
          <p>Carregando entregadores…</p>
        </div>
      ) : couriers.length === 0 ? (
        <div className="adm-empty"><p>Nenhum entregador cadastrado ainda.</p></div>
      ) : (
        <div className="adm-product-table-wrap">
          <table className="adm-product-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Telefone</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {couriers.map((courier) => (
                <tr key={courier.id} className={!courier.is_active ? "adm-row-inactive" : ""}>
                  <td className="adm-td-name">{courier.name}</td>
                  <td>{courier.phone || "—"}</td>
                  <td>
                    <span className={`adm-status-pill ${courier.is_active ? "active" : "inactive"}`}>
                      {courier.is_active ? "✅ Ativo" : "🚫 Inativo"}
                    </span>
                  </td>
                  <td className="adm-td-actions">
                    <button
                      className={`adm-btn-toggle ${courier.is_active ? "deactivate" : "activate"}`}
                      onClick={() => handleToggleActive(courier)}
                      disabled={busy}
                    >
                      {courier.is_active ? "🚫 Desativar" : "✅ Ativar"}
                    </button>
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
