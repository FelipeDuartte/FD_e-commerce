import { imgProduto } from "../../../utils/Cloudnary";
import { formatBRL } from "../confirmUtils";

export default function OrderItemsCard({ cartItems, total }) {
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
      <div className="cf-total-row">
        <span>Total pago</span>
        <span className="cf-total-value">{formatBRL(total)}</span>
      </div>
    </div>
  );
}
