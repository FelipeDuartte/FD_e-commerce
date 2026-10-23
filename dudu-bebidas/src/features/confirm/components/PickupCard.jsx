import { pickupAddress } from "../../../shared/utils/storeContact";

export default function PickupCard() {
  const address = pickupAddress();
  return (
    <div className="cf-tracker-card cf-tracker-card--pickup">
      <div className="cf-tracker-header">
        <span className="cf-tracker-label">🏪 RETIRADA NA LOJA</span>
      </div>
      <div className="cf-pickup-body">
        <div className="cf-pickup-icon">🏪</div>
        <h3 className="cf-pickup-title">Seu pedido está pronto!</h3>
        <p className="cf-pickup-desc">Passe na loja com seu código de retirada.</p>
        {address && (
          <div className="cf-pickup-address">
            <p className="cf-pickup-address-label">ENDEREÇO</p>
            <p className="cf-pickup-address-street">{address.street}</p>
            {address.detail && <p className="cf-pickup-address-city">{address.detail}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
