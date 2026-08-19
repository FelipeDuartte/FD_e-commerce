// Modal genérico pra desfechos finais (rejeitado / cancelado pelo cliente) —
// mesma estrutura nos dois casos, só muda ícone/título/texto.
export default function OrderOutcomeModal({ icon, title, children, onClose }) {
  return (
    <>
      <div className="cf-modal-overlay" />
      <div className="cf-modal" role="dialog" aria-modal="true">
        <div className="cf-modal-icon">{icon}</div>
        <h3 className="cf-modal-title">{title}</h3>
        <p className="cf-modal-desc">{children}</p>
        <div className="cf-modal-actions">
          <button className="cf-modal-btn-confirm" onClick={onClose}>
            Voltar para a loja
          </button>
        </div>
      </div>
    </>
  );
}
