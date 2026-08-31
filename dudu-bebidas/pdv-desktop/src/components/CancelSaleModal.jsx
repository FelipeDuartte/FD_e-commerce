import { formatBRL } from "../utils/format";

export default function CancelSaleModal({ sale, cancelling, onConfirm, onDismiss }) {
  return (
    <>
      <div className="adm-modal-overlay" onClick={() => !cancelling && onDismiss()} />
      <div className="adm-modal" role="dialog" aria-modal="true">
        <h2 className="adm-store-section-title">Cancelar venda</h2>
        <p className="adm-store-section-desc">
          Cancelar a venda de {formatBRL(sale.total)}? O estoque volta automaticamente.
        </p>
        <div className="adm-store-form-actions">
          <button className="adm-btn-new-product" onClick={onConfirm} disabled={cancelling}>
            {cancelling ? "Cancelando..." : "Sim, cancelar"}
          </button>
          <button className="adm-btn-back" onClick={onDismiss} disabled={cancelling}>
            Voltar
          </button>
        </div>
      </div>
    </>
  );
}
