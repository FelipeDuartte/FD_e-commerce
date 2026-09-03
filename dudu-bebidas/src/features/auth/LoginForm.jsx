import { Mail, Lock, Eye, EyeOff } from "lucide-react";

export default function LoginForm({
  formData, handleChange, showPassword, setShowPassword,
  loading, forgotLoading, onForgotPassword,
}) {
  return (
    <>
      <div className="form-group">
        <label className="form-label">E-mail</label>
        <div className="input-wrapper">
          <Mail size={20} className="input-icon" />
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="seu@email.com"
            className="form-input"
          />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Senha</label>
        <div className="input-wrapper">
          <Lock size={20} className="input-icon" />
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            className="form-input"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="password-toggle"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </div>

      <div className="forgot-password-wrapper">
        <button
          type="button"
          className="forgot-password-link"
          onClick={onForgotPassword}
          disabled={loading || forgotLoading}
        >
          {forgotLoading ? "Enviando..." : "Esqueci a senha"}
        </button>
      </div>
    </>
  );
}
