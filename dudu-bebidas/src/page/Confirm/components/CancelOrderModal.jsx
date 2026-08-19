export default function CancelOrderModal({
  entityLabel,
  shortId,
  cancelling,
  cancelError,
  onClose,
  onConfirm,
}) {
  return (
    <>
      <div className="cf-modal-overlay" onClick={() => !cancelling && onClose()} />
      <div className="cf-modal">
        <div className="cf-modal-icon">⚠️</div>
        <h3 className="cf-modal-title">Cancelar {entityLabel}?</h3>
        <p className="cf-modal-desc">
          Tem certeza que deseja cancelar{" "}
          {entityLabel === "retirada" ? "a retirada" : "o pedido"}{" "}
          <strong>#{shortId}</strong>? Esta ação não pode ser desfeita.
        </p>
        {cancelError && <div className="cf-modal-error">⚠️ {cancelError}</div>}
        <div className="cf-modal-actions">
          <button className="cf-modal-btn-cancel" onClick={onClose} disabled={cancelling}>
            Voltar
          </button>
          <button className="cf-modal-btn-confirm" onClick={onConfirm} disabled={cancelling}>
            {cancelling ? "Cancelando..." : "Sim, cancelar"}
          </button>
        </div>
      </div>
    </>
  );
}
