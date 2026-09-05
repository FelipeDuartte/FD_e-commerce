import { X } from "lucide-react";
import { useAuthForm } from "./useAuthForm";
import LoginForm from "./LoginForm";
import SignupForm from "./SignupForm";
import GoogleAuthButton from "./GoogleAuthButton";
import "./login.css";

export default function Login({ isOpen, onClose }) {
  const {
    isLogin, showPassword, setShowPassword, loading, forgotLoading,
    errorMsg, successMsg, formData,
    handleChange, handleSubmit, handleForgotPassword, toggleMode,
  } = useAuthForm(onClose);

  return (
    <>
      <div
        className={`login-overlay ${isOpen ? "show" : ""}`}
        onClick={onClose}
      />

      <div className={`login-modal ${isOpen ? "open" : ""}`}>
        <button onClick={onClose} className="login-close-btn">
          <X size={24} />
        </button>

        <div className="login-header">
          <div className="login-logo">
            <span className="logo-dudu">Dudu</span>
            <span className="logo-bebidas">Bebidas</span>
          </div>
          <h2 className="login-title">
            {isLogin ? "Bem-vindo!" : "Crie sua conta"}
          </h2>
          <p className="login-subtitle">
            {isLogin
              ? "Entre para continuar suas compras"
              : "Cadastre-se e aproveite nossas ofertas"}
          </p>
        </div>

        <div className="login-form">
          {errorMsg && <div className="form-message error">{errorMsg}</div>}

          {successMsg && (
            <div className="form-message success">{successMsg}</div>
          )}

          {isLogin ? (
            <LoginForm
              formData={formData}
              handleChange={handleChange}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              loading={loading}
              forgotLoading={forgotLoading}
              onForgotPassword={handleForgotPassword}
            />
          ) : (
            <SignupForm
              formData={formData}
              handleChange={handleChange}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
            />
          )}

          <button
            onClick={handleSubmit}
            className="login-submit-btn"
            disabled={loading}
          >
            {loading
              ? isLogin
                ? "Entrando..."
                : "Cadastrando..."
              : isLogin
                ? "Entrar"
                : "Cadastrar"}
          </button>

          <div className="login-divider">
            <span>ou</span>
          </div>

          <div className="social-login">
            <GoogleAuthButton />
          </div>

          <div className="toggle-mode">
            <p>
              {isLogin ? "Não tem uma conta?" : "Já tem uma conta?"}
              <button
                type="button"
                onClick={toggleMode}
                className="toggle-link"
              >
                {isLogin ? "Cadastre-se" : "Entrar"}
              </button>
            </p>
          </div>
        </div>

        <div className="login-footer">
          <p>Ao continuar, você concorda com nossos</p>
          <div className="footer-links">
            <a href="/terms-service" target="_blank">
              Termos de Uso
            </a>
            <span>•</span>
            <a href="/privacy-policy" target="_blank">
              Política de Privacidade
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
