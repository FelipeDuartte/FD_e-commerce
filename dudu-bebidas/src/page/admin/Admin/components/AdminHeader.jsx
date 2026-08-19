export default function AdminHeader({ onBack }) {
  return (
    <header className="adm-header">
      <div className="adm-header-left">
        <div className="adm-logo">
          <span className="adm-logo-dudu">Dudu</span>
          <span className="adm-logo-bebidas">Bebidas</span>
        </div>
        <div className="adm-badge">ADMIN</div>
      </div>
      <div className="adm-header-right">
        <span className="adm-admin-email">👤 Dudu bebidas</span>
        <button className="adm-btn-back" onClick={onBack}>
          ← Voltar à loja
        </button>
      </div>
    </header>
  );
}
