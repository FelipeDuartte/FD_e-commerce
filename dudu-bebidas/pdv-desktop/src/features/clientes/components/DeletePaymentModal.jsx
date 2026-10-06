import { formatBRL } from "../../../shared/utils/format";

export default function DeletePaymentModal({ payment, deleting, deleteError, onConfirm, onDismiss }) {
  return (
    <>
      <div className="adm-modal-overlay" onClick={() => !deleting && onDismiss()} />
      <div className="adm-modal" role="dialog" aria-modal="true">
        <h2 className="adm-store-section-title">Apagar pagamento</h2>
        <p className="adm-store-section-desc">
          Apagar o pagamento de <strong>{formatBRL(payment.amount)}</strong>? O saldo do cliente volta a
          incluir essa dívida. Se algum pedido deixar de estar quitado, o estoque dele volta.
        </p>

        {deleteError && <div className="adm-modal-error">⚠️ {deleteError}</div>}

        <div className="adm-store-form-actions">
          <button className="adm-btn-new-product pdv-delete-confirm-btn" onClick={onConfirm} disabled={deleting}>
            {deleting ? "Apagando..." : "Sim, apagar"}
          </button>
          <button className="adm-btn-back" onClick={onDismiss} disabled={deleting}>
            Cancelar
          </button>
        </div>
      </div>
    </>
  );
}
