import { useEffect, useRef, useState } from "react";
import { shareLocation } from "../services/courierService";

const SEND_INTERVAL_MS = 25000;

// Compartilha a posição do entregador só enquanto `active` for true (tem
// pelo menos um pedido "em entrega"). `watchPosition` deixa o navegador
// otimizar a frequência do GPS; quem decide o custo de rede/banco é o
// intervalo de ENVIO abaixo, fixo em ~25s — desacopla as duas coisas de
// propósito (ver Fase 2 do plano: polling, não conexão aberta).
export function useLocationSharing(active) {
  const [permissionDenied, setPermissionDenied] = useState(false);
  const lastPositionRef = useRef(null);

  useEffect(() => {
    if (!active || !("geolocation" in navigator)) return;

    setPermissionDenied(false);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        lastPositionRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      },
      (err) => {
        console.error("[useLocationSharing] geolocation erro:", err);
        if (err.code === err.PERMISSION_DENIED) setPermissionDenied(true);
      },
      { enableHighAccuracy: true, maximumAge: 20000 },
    );

    const sendLoop = setInterval(() => {
      const pos = lastPositionRef.current;
      if (pos) shareLocation(pos.lat, pos.lng);
    }, SEND_INTERVAL_MS);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(sendLoop);
      lastPositionRef.current = null;
    };
  }, [active]);

  return { permissionDenied };
}
