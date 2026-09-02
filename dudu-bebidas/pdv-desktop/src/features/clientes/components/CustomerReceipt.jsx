import { formatBRL } from "../../../shared/utils/format";

export default function CustomerReceipt({ tx, customerName }) {
  if (!tx) return null;

  return (
    <div className="pdv-print-receipt">
      <h2>Dudu Bebidas</h2>
      {tx.orderNumber != null && <p>Pedido #{tx.orderNumber}</p>}
      <p>{new Date(tx.createdAt).toLocaleString("pt-BR")}</p>
      <p>Cliente: {customerName}</p>
      <hr />
      <p>{tx.itemsLabel}</p>
      <hr />
      <p><strong>Total: {formatBRL(tx.total)}</strong></p>
      <p>Forma de pagamento: Fiado</p>
    </div>
  );
}
