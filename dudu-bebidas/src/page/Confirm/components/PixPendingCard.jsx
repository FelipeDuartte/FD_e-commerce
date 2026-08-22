import { formatBRL } from "../confirmUtils";

export default function PixPendingCard({
  customerClaimedPaidAt,
  pixLoading,
  pixError,
  pixCharge,
  pixQrImage,
  copied,
  claimingPaid,
  onCopyCode,
  onMarkPaid,
}) {
  return (
    <div className="cf-tracker-card">
      <div className="cf-tracker-header">
        <span className="cf-tracker-label">⚡ Pagamento via Pix</span>
      </div>

      {!customerClaimedPaidAt ? (
        <div className="cf-pix-block">
          {pixLoading && (
            <div className="cf-tracker-loading">
              <div className="cf-loading-bar" />
              <p>Gerando QR Code...</p>
            </div>
          )}
          {pixError && <div className="cf-modal-error">⚠️ {pixError}</div>}
          {pixCharge && !pixLoading && (
            <>
              <p className="cf-pix-instructions">
                Escaneie o QR Code ou copie o código abaixo no app do seu banco.
              </p>
              {pixQrImage && <img src={pixQrImage} alt="QR Code Pix" className="cf-pix-qr" />}
              <div className="cf-pix-value">{formatBRL(pixCharge.amount)}</div>
              <div className="cf-pix-code-row">
                <input readOnly value={pixCharge.brCode} className="cf-pix-code-input" />
                <button className="cf-btn-home" onClick={onCopyCode}>
                  {copied ? "✓ Copiado" : "Copiar código"}
                </button>
              </div>
              <button
                className="cf-btn-confirm-payment"
                onClick={onMarkPaid}
                disabled={claimingPaid}
              >
                {claimingPaid ? "Aguarde..." : "✅ Já paguei"}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="cf-pix-waiting">
          <p className="cf-pix-waiting-title">⏳ Aguardando confirmação do pagamento pela loja</p>
          <p className="cf-pix-waiting-hint">
            Assim que a loja confirmar o recebimento, seu pedido segue pro
            preparo normalmente. Isso costuma levar só alguns minutos.
          </p>
        </div>
      )}
    </div>
  );
}
