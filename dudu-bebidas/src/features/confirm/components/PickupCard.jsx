export default function PickupCard() {
  return (
    <div className="cf-tracker-card cf-tracker-card--pickup">
      <div className="cf-tracker-header">
        <span className="cf-tracker-label">🏪 RETIRADA NA LOJA</span>
      </div>
      <div className="cf-pickup-body">
        <div className="cf-pickup-icon">🏪</div>
        <h3 className="cf-pickup-title">Seu pedido está pronto!</h3>
        <p className="cf-pickup-desc">Passe na loja com seu código de retirada.</p>
        <div className="cf-pickup-address">
          <p className="cf-pickup-address-label">ENDEREÇO</p>
          <p className="cf-pickup-address-street">Rua Edgar Torres, 650</p>
          <p className="cf-pickup-address-city">Minas Caixa, Belo Horizonte - MG</p>
        </div>
      </div>
    </div>
  );
}
