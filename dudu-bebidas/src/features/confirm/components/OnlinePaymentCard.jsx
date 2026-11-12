export default function OnlinePaymentCard({ starting, checking, error, onPayNow }) {
  return (
    <div className="cf-tracker-card">
      <div className="cf-tracker-header">
        <span className="cf-tracker-label">🌐 Pagamento online</span>
      </div>
      <div className="cf-pix-waiting">
        {checking ? (
          <>
            <p className="cf-pix-waiting-title">⏳ Confirmando seu pagamento…</p>
            <p className="cf-pix-waiting-hint">Isso leva só alguns segundos.</p>
          </>
        ) : (
          <>
            <p className="cf-pix-waiting-title">Falta pagar para a loja receber seu pedido</p>
            <p className="cf-pix-waiting-hint">
              Pix ou cartão em até 12x. O link vale 30 minutos.
            </p>
            {error && <div className="cf-modal-error">⚠️ {error}</div>}
            <button className="cf-btn-home" onClick={onPayNow} disabled={starting}>
              {starting ? "Abrindo pagamento…" : "💳 Pagar agora"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
