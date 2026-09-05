import { useState, useEffect, useCallback } from "react";
import {
  listTeam,
  promoteToAdmin,
  demoteFromAdmin,
  getCurrentUserId,
} from "../services/teamService";

export default function TeamSection() {
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

  useEffect(() => {
    const timer = setTimeout(() => { reload(); }, 0);
    return () => clearTimeout(timer);
  }, [reload]);

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
