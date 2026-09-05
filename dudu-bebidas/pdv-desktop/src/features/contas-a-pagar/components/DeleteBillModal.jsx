export default function DeleteBillModal({ bill, deleting, deleteError, onConfirm, onDismiss }) {
  return (
    <>
      <div className="adm-modal-overlay" onClick={() => !deleting && onDismiss()} />
      <div className="adm-modal" role="dialog" aria-modal="true">
        <h2 className="adm-store-section-title">Excluir conta</h2>
        <p className="adm-store-section-desc">
          Excluir <strong>{bill.description}</strong> permanentemente? Essa ação não pode ser desfeita.
        </p>

        {deleteError && <div className="adm-modal-error">⚠️ {deleteError}</div>}

        <div className="adm-store-form-actions">
          <button className="adm-btn-new-product pdv-delete-confirm-btn" onClick={onConfirm} disabled={deleting}>
            {deleting ? "Excluindo..." : "Sim, excluir"}
          </button>
          <button className="adm-btn-back" onClick={onDismiss} disabled={deleting}>
            Cancelar
          </button>
        </div>
      </div>
    </>
  );
}
