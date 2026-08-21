export default function MercadoPagoProcessingCard({ rejected }) {
  return (
    <div className="cf-tracker-card">
      <div className="cf-tracker-header">
        <span className="cf-tracker-label">💳 Pagamento com cartão</span>
      </div>
      <div className="cf-pix-waiting">
        {rejected ? (
          <>
            <p className="cf-pix-waiting-title">❌ Pagamento recusado pela operadora</p>
            <p className="cf-pix-waiting-hint">
              Não conseguimos aprovar o pagamento com esse cartão. Nenhum
              valor foi cobrado — entre em contato com a loja ou faça um
              novo pedido com outra forma de pagamento.
            </p>
          </>
        ) : (
          <>
            <p className="cf-pix-waiting-title">⏳ Confirmando seu pagamento</p>
            <p className="cf-pix-waiting-hint">
              Estamos aguardando a confirmação do Mercado Pago. Assim que o
              pagamento for aprovado, seu pedido segue pro preparo
              automaticamente — isso costuma levar só alguns segundos.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
