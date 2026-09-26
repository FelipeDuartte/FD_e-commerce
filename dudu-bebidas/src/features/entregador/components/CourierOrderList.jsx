import { useCallback, useEffect, useState } from "react";
import { listMyDeliveries, advanceDeliveryStatus } from "../services/courierService";
import CourierOrderCard from "./CourierOrderCard";

export default function CourierOrderList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      setOrders(await listMyDeliveries());
      setError("");
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    // Sem Realtime de propósito (Fase 1) — atualiza sozinho de tempos em
    // tempos, suficiente pra pegar um pedido novo atribuído pelo admin.
    const interval = setInterval(reload, 15000);
    return () => clearInterval(interval);
  }, [reload]);

  const handleAdvance = async (orderId) => {
    await advanceDeliveryStatus(orderId);
    await reload();
  };

  if (loading) {
    return <div className="ent-loading">Carregando suas entregas...</div>;
  }

  if (error) {
    return <div className="ent-error ent-error-page">⚠️ {error}</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="ent-empty">
        <p>📦 Nenhuma entrega atribuída a você agora.</p>
        <p className="ent-empty-hint">Essa lista atualiza sozinha.</p>
      </div>
    );
  }

  return (
    <div className="ent-list">
      {orders.map((order) => (
        <CourierOrderCard key={order.id} order={order} onAdvance={handleAdvance} />
      ))}
    </div>
  );
}
