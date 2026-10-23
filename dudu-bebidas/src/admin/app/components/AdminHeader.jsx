import { getBrand } from "../../../shared/brand/brand";

export default function AdminHeader({ onBack, theme, onToggleTheme }) {
  const { name, logoText } = getBrand();
  return (
    <header className="adm-header">
      <div className="adm-header-left">
        <div className="adm-logo">
          <span className="adm-logo-dudu">{logoText[0]}</span>
          {logoText[1] && <span className="adm-logo-bebidas">{logoText[1]}</span>}
        </div>
        <div className="adm-badge">ADMIN</div>
      </div>
      <div className="adm-header-right">
        <span className="adm-admin-email">👤 {name}</span>
        <button
          className="adm-theme-toggle"
          onClick={onToggleTheme}
          title={theme === "light" ? "Mudar para tema escuro" : "Mudar para tema claro"}
        >
          {theme === "light" ? "🌙" : "☀️"}
        </button>
        <button className="adm-btn-back" onClick={onBack}>
          ← Voltar à loja
        </button>
      </div>
    </header>
  );
}
