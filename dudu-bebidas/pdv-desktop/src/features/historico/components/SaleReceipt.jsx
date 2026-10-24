import { formatBRL } from "../../../shared/utils/format";
import { formatSalePaymentLabel } from "../../../shared/constants";
import { getCurrentStore } from "../../../shared/supabase/Supabaseclient";

const cents = (n) => Math.round(Number(n || 0) * 100) / 100;

// Item numa linha só: "NOME x3" à esquerda e o total da linha à direita.
// Item devolvido por inteiro (quantidade 0) sai sem valor.
function ReceiptItem({ item }) {
  if (item.quantity === 0) {
    return <div className="pdv-receipt-item">{item.name} (devolvido)</div>;
  }
  return (
    <div className="pdv-receipt-row pdv-receipt-item">
      <span className="pdv-receipt-item-name">
        {item.name}{item.quantity > 1 && ` x${item.quantity}`}
      </span>
      <span className="pdv-receipt-item-price">{formatBRL(item.price * item.quantity)}</span>
    </div>
  );
}

// Só existe pra virar a única coisa visível na tela quando window.print()
// dispara (ver handlePrint em HistorySalesList) — notinha simples pro
// entregador levar junto do pedido.
export default function SaleReceipt({ sale }) {
  if (!sale) return null;

  const showInstallments = sale.paymentMethod === "credit_card" && sale.installments > 1;
  // Cabeçalho com os dados da loja logada (stores: logo_url, name,
  // pickup_address, phone) — cada loja imprime a própria notinha.
  const store = getCurrentStore() ?? {};

  const items = sale.orderItems ?? [];
  const itemsTotal = cents(items.reduce((sum, it) => sum + it.price * it.quantity, 0));
  const discount = cents(sale.discountAmount);
  const cardFee = cents(sale.cardFeeAmount);
  // O que sobra do total depois de itens, desconto e taxa é o frete
  const delivery = cents(sale.total - cardFee + discount - itemsTotal);

  return (
    <div className="pdv-print-receipt">
      {store.logo_url && <img src={store.logo_url} alt={store.name} className="pdv-receipt-logo" />}

      <div className="pdv-receipt-header">
        <strong>{store.name}</strong>
        {store.pickup_address && <div>{store.pickup_address}</div>}
        {store.phone && <div>{store.phone}</div>}
        {sale.orderNumber != null && <div>Pedido #{sale.orderNumber}</div>}
        <div>{new Date(sale.createdAt).toLocaleString("pt-BR")}</div>
      </div>

      {sale.deliveryAddress && (
        <>
          <div className="pdv-receipt-divider" />
          <div className="pdv-receipt-delivery">
            <strong>🚚 ENTREGAR EM:</strong>
            {sale.deliveryAddress.name && <div>{sale.deliveryAddress.name}</div>}
            <div>
              {sale.deliveryAddress.street}, {sale.deliveryAddress.number}
            </div>
            {sale.deliveryAddress.complement && <div>{sale.deliveryAddress.complement}</div>}
            {sale.deliveryAddress.district && <div>{sale.deliveryAddress.district}</div>}
            {sale.deliveryAddress.phone && <div>📞 {sale.deliveryAddress.phone}</div>}
          </div>
        </>
      )}

      <div className="pdv-receipt-divider" />

      {items.length > 0
        ? items.map((item) => <ReceiptItem key={item.id ?? item.name} item={item} />)
        : <div>{sale.itemCount} item(ns)</div>}

      <div className="pdv-receipt-divider" />

      {(discount > 0 || cardFee > 0 || delivery > 0) && (
        <>
          <div className="pdv-receipt-row">
            <span>Subtotal</span>
            <span>{formatBRL(itemsTotal)}</span>
          </div>
          {delivery > 0 && (
            <div className="pdv-receipt-row">
              <span>Entrega</span>
              <span>{formatBRL(delivery)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="pdv-receipt-row">
              <span>Desconto</span>
              <span>- {formatBRL(discount)}</span>
            </div>
          )}
          {cardFee > 0 && (
            <div className="pdv-receipt-row">
              <span>Taxa do cartão</span>
              <span>+ {formatBRL(cardFee)}</span>
            </div>
          )}
        </>
      )}

      <div className="pdv-receipt-total">
        <span>Total</span>
        <strong>{formatBRL(sale.total)}</strong>
      </div>
      <div>Pagamento: {formatSalePaymentLabel(sale)}</div>
      {sale.paymentMethod === "misto" && sale.payments?.length > 0 && (
        <div className="pdv-receipt-split">
          {sale.payments.map((p, i) => (
            <div key={i}>{formatSalePaymentLabel({ paymentMethod: p.method })}: {formatBRL(p.amount)}</div>
          ))}
        </div>
      )}
      {showInstallments && <div>Parcelado em {sale.installments}x</div>}
    </div>
  );
}
