import { formatBRL } from "../../../../shared/utils/format";
import { PAYMENT_METHODS } from "../../../../shared/utils/paymentMethods";
import { getCurrentStore } from "../../../../shared/supabase/Supabaseclient";
import { receiptTotals } from "../receiptTotals";

// Só existe pra virar a única coisa visível quando window.print() dispara
// (ver handlePrint em OrdersTab) — mesmo layout da notinha do PDV, pra
// bobina térmica de 80mm.
export default function OrderReceipt({ order }) {
  if (!order) return null;

  const store = getCurrentStore() ?? {};
  const address = order.address ?? {};
  const pickup = Boolean(address.isRetirada);
  const items = order.order_items ?? [];
  const { itemsTotal, discount, cardFee, delivery } = receiptTotals(order);
  const payment = PAYMENT_METHODS[order.payment_method]?.label ?? order.payment_method;
  const paid = order.payment_status === "pago";

  return (
    <div className="adm-print-receipt">
      {store.logo_url && <img src={store.logo_url} alt={store.name} className="adm-receipt-logo" />}

      <div className="adm-receipt-header">
        <strong>{store.name}</strong>
        {store.pickup_address && <div>{store.pickup_address}</div>}
        {store.phone && <div>{store.phone}</div>}
        {order.order_number != null && <div>Pedido #{order.order_number} · Site</div>}
        <div>{new Date(order.created_at).toLocaleString("pt-BR")}</div>
      </div>

      <div className="adm-receipt-divider" />
      <div className="adm-receipt-delivery">
        {pickup ? (
          <>
            <strong>🏪 RETIRADA NA LOJA</strong>
            {address.name && <div>{address.name}</div>}
            {address.phone && <div>📞 {address.phone}</div>}
          </>
        ) : (
          <>
            <strong>🚚 ENTREGAR EM:</strong>
            {address.name && <div>{address.name}</div>}
            <div>
              {address.street}{address.number ? `, ${address.number}` : ""}
            </div>
            {address.complement && <div>{address.complement}</div>}
            {address.district && <div>{address.district}</div>}
            {address.phone && <div>📞 {address.phone}</div>}
          </>
        )}
      </div>

      <div className="adm-receipt-divider" />

      {items.map((item) => (
        <div className="adm-receipt-row adm-receipt-item" key={item.id ?? item.name}>
          <span className="adm-receipt-item-name">
            {item.name}{item.quantity > 1 && ` x${item.quantity}`}
          </span>
          <span className="adm-receipt-item-price">{formatBRL(Number(item.price) * item.quantity)}</span>
        </div>
      ))}

      <div className="adm-receipt-divider" />

      {(discount > 0 || cardFee > 0 || delivery > 0) && (
        <>
          <div className="adm-receipt-row"><span>Subtotal</span><span>{formatBRL(itemsTotal)}</span></div>
          {delivery > 0 && (
            <div className="adm-receipt-row"><span>Entrega</span><span>{formatBRL(delivery)}</span></div>
          )}
          {discount > 0 && (
            <div className="adm-receipt-row"><span>Desconto</span><span>- {formatBRL(discount)}</span></div>
          )}
          {cardFee > 0 && (
            <div className="adm-receipt-row"><span>Taxa do cartão</span><span>+ {formatBRL(cardFee)}</span></div>
          )}
        </>
      )}

      <div className="adm-receipt-total">
        <span>Total</span>
        <strong>{formatBRL(order.total)}</strong>
      </div>
      <div>
        Pagamento: {payment}
        {order.installments > 1 && ` em ${order.installments}x`}
      </div>
      <div className="adm-receipt-paid">{paid ? "✅ PAGO" : pickup ? "💰 COBRAR NA RETIRADA" : "💰 COBRAR NA ENTREGA"}</div>
    </div>
  );
}
