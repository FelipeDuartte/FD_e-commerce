export default function UndoPurchaseModal({ movement, undoing, undoError, onConfirm, onDismiss }) {
  return (
    <>
      <div className="adm-modal-overlay" onClick={() => !undoing && onDismiss()} />
      <div className="adm-modal" role="dialog" aria-modal="true">
        <h2 className="adm-store-section-title">Desfazer compra</h2>
        <p className="adm-store-section-desc">
          Desfazer a compra de <strong>+{movement.quantity} {movement.productName}</strong>? O estoque volta a
          diminuir essa quantidade e o custo do produto volta pro valor de antes dessa compra. Só funciona se
          nenhuma outra movimentação tiver acontecido com esse produto depois dela.
        </p>

        {undoError && <div className="adm-modal-error">⚠️ {undoError}</div>}

        <div className="adm-store-form-actions">
          <button className="adm-btn-new-product pdv-delete-confirm-btn" onClick={onConfirm} disabled={undoing}>
            {undoing ? "Desfazendo..." : "Sim, desfazer"}
          </button>
          <button className="adm-btn-back" onClick={onDismiss} disabled={undoing}>
            Cancelar
          </button>
        </div>
      </div>
    </>
  );
}
