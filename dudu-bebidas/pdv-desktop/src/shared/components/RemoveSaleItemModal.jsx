export default function RemoveSaleItemModal({ item, removing, removeError, onConfirm, onDismiss }) {
  return (
    <>
      <div className="adm-modal-overlay" onClick={() => !removing && onDismiss()} />
      <div className="adm-modal" role="dialog" aria-modal="true">
        <h2 className="adm-store-section-title">Remover item</h2>
        <p className="adm-store-section-desc">
          Remover <strong>{item.quantity > 1 ? `${item.name} x${item.quantity}` : item.name}</strong> desse pedido em
          aberto? O estoque volta automaticamente. Se for o único item, o pedido inteiro é cancelado.
        </p>

        {removeError && <div className="adm-modal-error">⚠️ {removeError}</div>}

        <div className="adm-store-form-actions">
          <button className="adm-btn-new-product pdv-delete-confirm-btn" onClick={onConfirm} disabled={removing}>
            {removing ? "Removendo..." : "Sim, remover"}
          </button>
          <button className="adm-btn-back" onClick={onDismiss} disabled={removing}>
            Voltar
          </button>
        </div>
      </div>
    </>
  );
}
