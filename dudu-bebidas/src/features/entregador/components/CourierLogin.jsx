import { useState } from "react";

export default function CourierLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const errorMessage = await onLogin(email, password);
    if (errorMessage) setError("E-mail ou senha incorretos.");
    setLoading(false);
  };

  return (
    <div className="ent-login-wrap">
      <form className="ent-login-card" onSubmit={handleSubmit}>
        <h1 className="ent-login-title">🛵 Área do Entregador</h1>
        <p className="ent-login-subtitle">Entre com o login que a loja te passou.</p>

        <label className="ent-login-label">E-mail</label>
        <input
          className="ent-login-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          required
        />

        <label className="ent-login-label">Senha</label>
        <input
          className="ent-login-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <div className="ent-error">⚠️ {error}</div>}

        <button className="ent-btn-advance" type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
