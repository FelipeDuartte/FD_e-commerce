export default function DeliveryAddressCard({ address }) {
  return (
    <div className="cf-card">
      <div className="cf-card-label">📍 Endereço de Entrega</div>
      <div className="cf-address">
        <p className="cf-address-name">{address.name}</p>
        <p>
          {address.street}, {address.number}
          {address.complement ? ` — ${address.complement}` : ""}
        </p>
        <p>{address.district}</p>
        <p className="cf-address-phone">📞 {address.phone}</p>
      </div>
    </div>
  );
}
