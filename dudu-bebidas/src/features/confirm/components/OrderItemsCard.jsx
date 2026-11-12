import { imgProduto } from "../../../shared/utils/Cloudnary";
import { formatBRL, orderBreakdown } from "../confirmUtils";

export default function OrderItemsCard({ cartItems, total, deliveryFee, isRetirada }) {
  const { subtotal, deliveryFee: fee, cardFee, otherFees } = orderBreakdown(cartItems, total, deliveryFee);
  const showSummary = fee > 0 || cardFee > 0 || otherFees > 0 || (fee === 0 && !isRetirada);

  return (
    <div className="cf-card">
      <div className="cf-card-label">🛒 Itens do Pedido</div>
      <div className="cf-items">
        {cartItems.map((item, i) => (
          <div className="cf-item" key={i}>
            <div className="cf-item-img">
              {item.imagem || item.icon ? (
                <img src={imgProduto(item.imagem || item.icon)} alt={item.nome || item.name} />
              ) : (
                "🍺"
              )}
            </div>
            <div className="cf-item-info">
              <span className="cf-item-name">{item.nome || item.name}</span>
              <span className="cf-item-qty">{item.quantity} unidade(s)</span>
            </div>
            <span className="cf-item-price">
              {formatBRL((item.preco || item.price) * item.quantity)}
            </span>
          </div>
        ))}
      </div>
      {showSummary && (
        <div className="cf-summary">
          <div className="cf-summary-row">
            <span>Subtotal</span>
            <span>{formatBRL(subtotal)}</span>
          </div>
          {fee != null && !isRetirada && (
            <div className="cf-summary-row">
              <span>Entrega</span>
              <span>{fee > 0 ? formatBRL(fee) : "Grátis"}</span>
            </div>
          )}
          {cardFee > 0 && (
            <div className="cf-summary-row">
              <span>Taxa do cartão</span>
              <span>{formatBRL(cardFee)}</span>
            </div>
          )}
          {otherFees > 0 && (
            <div className="cf-summary-row">
              <span>Entrega e taxas</span>
              <span>{formatBRL(otherFees)}</span>
            </div>
          )}
        </div>
      )}
      <div className="cf-total-row">
        <span>Total pago</span>
        <span className="cf-total-value">{formatBRL(total)}</span>
      </div>
    </div>
  );
}
