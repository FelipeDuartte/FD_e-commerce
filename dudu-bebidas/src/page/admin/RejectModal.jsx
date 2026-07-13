import { shortOrderId } from "../../utils/orderId";

export default function RejectModal({
  rejectModal,
  closeRejectModal,
  confirmReject,
  rejectError,
  rejecting,
}) {
  return (
    <>
      <div className="adm-modal-overlay" onClick={closeRejectModal} />
      <div className="adm-modal" role="dialog" aria-modal="true">
        <div className="adm-modal-icon">🚫</div>
        <h3 className="adm-modal-title">Rejeitar pedido?</h3>
        <p className="adm-modal-desc">
          Tem certeza que deseja <strong>rejeitar</strong> o pedido{" "}
          <strong>#{shortOrderId(rejectModal)}</strong>? Será{" "}
          <strong>apagado permanentemente</strong>.
        </p>
        {rejectError && <div className="adm-modal-error">⚠️ {rejectError}</div>}
        <div className="adm-modal-actions">
          <button
            className="adm-modal-btn-back"
            onClick={closeRejectModal}
            disabled={rejecting}
          >
            Cancelar
          </button>
          <button
            className="adm-modal-btn-reject"
            onClick={confirmReject}
            disabled={rejecting}
          >
            {rejecting ? "Rejeitando..." : "Sim, rejeitar"}
          </button>
        </div>
      </div>
    </>
  );
}
