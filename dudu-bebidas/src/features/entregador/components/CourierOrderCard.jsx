import { useState } from "react";
import { formatBRL } from "../../../shared/utils/format";
import { PAYMENT_METHODS } from "../../../shared/utils/paymentMethods";
import { mapsUrlFor } from "../services/courierService";

const STATUS_LABEL = {
  preparing: { icon: "👨‍🍳", label: "Preparando", next: "Saí para entrega" },
  on_the_way: { icon: "🛵", label: "Em entrega", next: "Entreguei" },
};

export default function CourierOrderCard({ order, onAdvance }) {
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState("");
  const cfg = STATUS_LABEL[order.status];
  const payment = PAYMENT_METHODS[order.payment_method] ?? { icon: "💳", label: order.payment_method };
  const shortId = order.order_number ? String(order.order_number) : order.id.slice(-8).toUpperCase();

  const handleAdvance = async () => {
    setAdvancing(true);
    setError("");
    try {
      await onAdvance(order.id);
    } catch (e) {
      setError(e.message);
    }
    setAdvancing(false);
  };

  return (
    <div className="ent-card">
      <div className="ent-card-top">
        <span className="ent-order-id">#{shortId}</span>
        <span className="ent-status-pill">{cfg?.icon} {cfg?.label}</span>
      </div>

      <div className="ent-card-section">
        <strong>{order.address?.name}</strong>
        <p>
          {order.address?.street}, {order.address?.number}
          {order.address?.complement ? ` — ${order.address.complement}` : ""}
        </p>
        <p>{order.address?.district}</p>
        <p>📞 {order.address?.phone}</p>
      </div>

      <div className="ent-card-section ent-card-row">
        <span>{payment.icon} {payment.label}</span>
        <strong>{formatBRL(order.total)}</strong>
      </div>

      {error && <div className="ent-error">⚠️ {error}</div>}

      <div className="ent-card-actions">
        <a
          className="ent-btn-map"
          href={mapsUrlFor(order.address)}
          target="_blank"
          rel="noreferrer"
        >
          🗺️ Abrir no mapa
        </a>
        <button className="ent-btn-advance" onClick={handleAdvance} disabled={advancing}>
          {advancing ? "Atualizando..." : `✓ ${cfg?.next}`}
        </button>
      </div>
    </div>
  );
}
