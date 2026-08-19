export default function AdminTabs({ activeTab, onChange, ordersCount, productsCount }) {
  const tabs = [
    { key: "pedidos", label: "📦 Pedidos", badge: ordersCount },
    { key: "produtos", label: "🍺 Produtos", badge: productsCount },
    { key: "relatorios", label: "📊 Relatórios", badge: null },
    { key: "loja", label: "🏪 Loja", badge: null },
    { key: "pdv", label: "🧾 PDV", badge: null },
    { key: "estoque", label: "📦 Estoque", badge: null },
  ];

  return (
    <div className="adm-tabs">
      {tabs.map(({ key, label, badge }) => (
        <button
          key={key}
          className={`adm-tab ${activeTab === key ? "adm-tab-active" : ""}`}
          onClick={() => onChange(key)}
        >
          {label}
          {badge != null && badge > 0 && (
            <span className="adm-tab-badge">{badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}
