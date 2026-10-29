import { useEffect, useRef, useState } from "react";
import { shareLocation } from "../services/courierService";

const SEND_INTERVAL_MS = 25000;

// Compartilha a posição do entregador só enquanto `active` for true (tem
// pelo menos um pedido "em entrega"). `watchPosition` deixa o navegador
// otimizar a frequência do GPS; quem decide o custo de rede/banco é o
// intervalo de ENVIO, fixo em ~25s.
//
// Fora do intervalo, envia na hora em dois momentos: no primeiro sinal de
// GPS e quando o entregador volta pra página (o celular pausa a página
// quando ele abre outro app ou bloqueia a tela — sem isso, o cliente
// esperaria até 25s depois da volta pra ver a moto de novo).
export function useLocationSharing(active) {
  const [permissionDenied, setPermissionDenied] = useState(false);
  const lastPositionRef = useRef(null);

  useEffect(() => {
    if (!active || !("geolocation" in navigator)) return undefined;

    setPermissionDenied(false);
    let sentFirst = false;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        lastPositionRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!sentFirst) {
          sentFirst = true;
          shareLocation(lastPositionRef.current.lat, lastPositionRef.current.lng);
        }
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

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          lastPositionRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          shareLocation(lastPositionRef.current.lat, lastPositionRef.current.lng);
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
      );
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(sendLoop);
      document.removeEventListener("visibilitychange", onVisibility);
      lastPositionRef.current = null;
    };
  }, [active]);

  return { permissionDenied };
}
