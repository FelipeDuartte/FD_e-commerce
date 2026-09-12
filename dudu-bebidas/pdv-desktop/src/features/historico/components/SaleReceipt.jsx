import { formatBRL } from "../../../shared/utils/format";
import { PAYMENT_METHODS } from "../../../shared/constants";

function methodLabel(method) {
  const known = PAYMENT_METHODS.find((m) => m.value === method);
  return known ? `${known.icon} ${known.label}` : method;
}

// Uma linha por item em vez do texto corrido — cabe melhor na largura
// estreita da bobina térmica (ver .pdv-print-receipt em Pdv.css).
function itemLines(sale) {
  if (!sale.itemsLabel) return [`${sale.itemCount} item(ns)`];
  return sale.itemsLabel.split(", ");
}

// Só existe pra virar a única coisa visível na tela quando window.print()
// dispara (ver handlePrint em HistorySalesList) — notinha simples pro
// entregador levar junto do pedido.
export default function SaleReceipt({ sale }) {
  if (!sale) return null;

  const showInstallments = sale.paymentMethod === "credit_card" && sale.installments > 1;

  return (
    <div className="pdv-print-receipt">
      <img src="/logo.png" alt="Dudu Bebidas" className="pdv-receipt-logo" />

      <div className="pdv-receipt-header">
        <strong>Dudu Bebidas</strong>
        <div>Edgard Torres, 650</div>
        <div>(34) 3451-0200</div>
        {sale.orderNumber != null && <div>Pedido #{sale.orderNumber}</div>}
        <div>{new Date(sale.createdAt).toLocaleString("pt-BR")}</div>
      </div>

      <div className="pdv-receipt-divider" />

      {itemLines(sale).map((line) => (
        <div key={line}>{line}</div>
      ))}

      <div className="pdv-receipt-divider" />

      <div className="pdv-receipt-total">
        <span>Total</span>
        <strong>{formatBRL(sale.total)}</strong>
      </div>
      <div>Pagamento: {methodLabel(sale.paymentMethod)}</div>
      {showInstallments && <div>Parcelado em {sale.installments}x</div>}
    </div>
  );
}
