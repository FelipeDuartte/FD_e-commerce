import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { listMyDeliveries, advanceDeliveryStatus, destinationFor } from "../services/courierService";
import { useLocationSharing } from "../hooks/useLocationSharing";
import { useWakeLock } from "../hooks/useWakeLock";
import CourierOrderCard from "./CourierOrderCard";
import { unlockSpeech } from "../utils/speech";

// O mapa de navegação (mapbox-gl) é pesado — só baixa quando abre
const CourierNavigation = lazy(() => import("./CourierNavigation"));

// Corte de segurança: se um pedido ficar "em entrega" por tempo demais
// (ex: admin esqueceu de marcar como entregue), para de compartilhar
// localização PRA ESSE PEDIDO — evita gastar bateria do entregador à toa
// depois que ele já claramente não está mais entregando aquilo. Número
// bem folgado de propósito, pra nunca cortar uma entrega genuinamente
// demorada (trânsito, fila, etc). Não muda o status do pedido sozinho —
// isso continua sendo decisão do admin.
const LOCATION_SHARE_CUTOFF_HOURS = 2;

function isWithinShareCutoff(order) {
  if (!order.on_the_way_at) return true; // sem timestamp (dado antigo) — compartilha normalmente
  const hoursSince = (Date.now() - new Date(order.on_the_way_at).getTime()) / 3_600_000;
  return hoursSince < LOCATION_SHARE_CUTOFF_HOURS;
}

export default function CourierOrderList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nav, setNav] = useState(null); // { destination, label }
  const [navError, setNavError] = useState("");

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

  const hasActiveDelivery = useMemo(
    () => orders.some((o) => o.status === "on_the_way" && isWithinShareCutoff(o)),
    [orders],
  );
  const { permissionDenied } = useLocationSharing(hasActiveDelivery);
  // Tela acesa durante a entrega: com a tela bloqueada a página pausa e o
  // cliente para de ver a moto
  useWakeLock(hasActiveDelivery);

  const handleNavigate = async (order) => {
    unlockSpeech(); // precisa ser no toque, senão o iPhone não fala depois
    setNavError("");
    const destination = await destinationFor(order);
    if (!destination) {
      setNavError("Não encontramos esse endereço no mapa. Use o Google Maps para este pedido.");
      return;
    }
    const a = order.address ?? {};
    setNav({ destination, label: [a.street, a.number].filter(Boolean).join(", ") || "Cliente" });
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
      {nav && (
        <Suspense fallback={<div className="ent-nav ent-nav-loading">Abrindo o mapa…</div>}>
          <CourierNavigation destination={nav.destination} label={nav.label} onClose={() => setNav(null)} />
        </Suspense>
      )}
      {navError && <div className="ent-error">⚠️ {navError}</div>}
      {hasActiveDelivery && permissionDenied && (
        <div className="ent-error">
          ⚠️ Ative a localização do navegador pra compartilhar sua posição com o cliente. Você ainda pode ver e avançar suas entregas normalmente.
        </div>
      )}
      {hasActiveDelivery && !permissionDenied && (
        <div className="ent-location-badge">📍 Compartilhando sua localização</div>
      )}
      {orders.map((order) => (
        <CourierOrderCard key={order.id} order={order} onAdvance={handleAdvance} onNavigate={handleNavigate} />
      ))}
    </div>
  );
}
