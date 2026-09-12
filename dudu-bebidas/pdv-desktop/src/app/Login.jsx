import { useState } from "react";
import { supabase } from "../shared/supabase/Supabaseclient";

export default function Login({ theme, onToggleTheme }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg("Preencha e-mail e senha.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setErrorMsg(
        error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : error.message,
      );
    }
  };

  return (
    <div className="pdv-login-screen">
      <button
        type="button"
        className="adm-theme-toggle pdv-login-theme-toggle"
        onClick={onToggleTheme}
        title={theme === "light" ? "Mudar para tema escuro" : "Mudar para tema claro"}
      >
        {theme === "light" ? "🌙" : "☀️"}
      </button>
      <form className="pdv-login-card" onSubmit={handleSubmit}>
        <h1 className="adm-title pdv-login-title">
          <img src="/fdigital-logo.png" alt="FDigital" className="pdv-login-logo" />
          FDigital
        </h1>
        <p className="adm-subtitle">Entre com sua conta de administrador da loja.</p>

        {errorMsg && <div className="adm-modal-error">⚠️ {errorMsg}</div>}

        <div className="adm-form-field">
          <label>E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            autoFocus
          />
        </div>

        <div className="adm-form-field">
          <label>Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <button type="submit" className="adm-btn-new-product" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
