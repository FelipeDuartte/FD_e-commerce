import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { loginGoogle } from "../../supabase/Supabaseclient";
import { X, Mail, Lock, Eye, EyeOff, User, Phone } from "lucide-react";
import "./Login.css";

// Supabase client
const supabase = createClient(
  "https://ixjhyzzocdsufcqgbbvf.supabase.co",
  "sb_publishable_kA5ukt5jIQMlUGAw7PVfSA_wsoJIhL_"
);

export default function Login({ isOpen, onClose }) {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    confirmPassword: "",
  });

  const handleChange = (e) => {
    setErrorMsg("");
    setSuccessMsg("");
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (isLogin) {
      // ── LOGIN ──────────────────────────────────────────────
      if (!formData.email || !formData.password) {
        setErrorMsg("Por favor, preencha todos os campos!");
        return;
      }

      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });
      setLoading(false);

      if (error) {
        setErrorMsg(
          error.message === "Invalid login credentials"
            ? "E-mail ou senha incorretos."
            : error.message
        );
        return;
      }

      setSuccessMsg(`Bem-vindo de volta, ${data.user.email}!`);
      setTimeout(() => {
        resetForm();
        onClose();
      }, 1200);

    } else {
      // ── CADASTRO ───────────────────────────────────────────
      if (
        !formData.name ||
        !formData.email ||
        !formData.phone ||
        !formData.password ||
        !formData.confirmPassword
      ) {
        setErrorMsg("Por favor, preencha todos os campos!");
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setErrorMsg("As senhas não coincidem!");
        return;
      }
      if (formData.password.length < 6) {
        setErrorMsg("A senha deve ter pelo menos 6 caracteres.");
        return;
      }

      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.name,
            phone: formData.phone,
          },
        },
      });
      setLoading(false);

      if (error) {
        setErrorMsg(
          error.message === "User already registered"
            ? "Este e-mail já está cadastrado."
            : error.message
        );
        return;
      }

      // Supabase pode exigir confirmação de e-mail
      if (data.user && data.user.identities?.length === 0) {
        setErrorMsg("Este e-mail já está cadastrado.");
        return;
      }

      setSuccessMsg(
        `Cadastro realizado! Verifique seu e-mail para confirmar a conta, ${formData.name}.`
      );
      setTimeout(() => {
        resetForm();
        onClose();
      }, 2000);
    }
  };

  const resetForm = () => {
    setFormData({
      email: "",
      password: "",
      name: "",
      phone: "",
      confirmPassword: "",
    });
    setErrorMsg("");
    setSuccessMsg("");
    setShowPassword(false);
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    resetForm();
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`login-overlay ${isOpen ? "show" : ""}`}
        onClick={onClose}
      />

      {/* Login Modal */}
      <div className={`login-modal ${isOpen ? "open" : ""}`}>
        {/* Close Button */}
        <button onClick={onClose} className="login-close-btn">
          <X size={24} />
        </button>

        {/* Header */}
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

        {/* Form */}
        <div className="login-form">

          {/* Mensagem de erro */}
          {errorMsg && (
            <div className="form-message error">
              {errorMsg}
            </div>
          )}

          {/* Mensagem de sucesso */}
          {successMsg && (
            <div className="form-message success">
              {successMsg}
            </div>
          )}

          {/* Nome - apenas no cadastro */}
          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Nome Completo</label>
              <div className="input-wrapper">
                <User size={20} className="input-icon" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Seu nome"
                  className="form-input"
                />
              </div>
            </div>
          )}

          {/* Email */}
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

          {/* Telefone - apenas no cadastro */}
          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Telefone</label>
              <div className="input-wrapper">
                <Phone size={20} className="input-icon" />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="(11) 99999-9999"
                  className="form-input"
                />
              </div>
            </div>
          )}

          {/* Senha */}
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

          {/* Confirmar Senha - apenas no cadastro */}
          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Confirmar Senha</label>
              <div className="input-wrapper">
                <Lock size={20} className="input-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="form-input"
                />
              </div>
            </div>
          )}

          {/* Forgot Password - apenas no login */}
          {isLogin && (
            <div className="forgot-password-wrapper">
              <a href="#" className="forgot-password-link">
                Esqueceu sua senha?
              </a>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            className="login-submit-btn"
            disabled={loading}
          >
            {loading
              ? isLogin ? "Entrando..." : "Cadastrando..."
              : isLogin ? "Entrar" : "Cadastrar"}
          </button>

          {/* Divider */}
          <div className="login-divider">
            <span>ou</span>
          </div>

          {/* Social Login */}
          <div className="social-login">
            <button type="button" className="social-btn google" onClick={loginGoogle} >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>
          </div>

          {/* Toggle Mode */}
          <div className="toggle-mode">
            <p>
              {isLogin ? "Não tem uma conta?" : "Já tem uma conta?"}
              <button type="button" onClick={toggleMode} className="toggle-link">
                {isLogin ? "Cadastre-se" : "Entrar"}
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="login-footer">
          <p>Ao continuar, você concorda com nossos</p>
          <div className="footer-links">
            <a href="#">Termos de Uso</a>
            <span>•</span>
            <a href="#">Política de Privacidade</a>
          </div>
        </div>
      </div>
    </>
  );
}