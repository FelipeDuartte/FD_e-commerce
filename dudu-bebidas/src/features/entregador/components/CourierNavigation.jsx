import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { fetchRoute } from "../services/directionsService";
import { useWakeLock } from "../hooks/useWakeLock";
import { bearingDegrees, distanceMeters, formatDistance, projectOnRoute } from "../utils/navMath";
import { speak } from "../utils/speech";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? "";

const OFF_ROUTE_METERS = 40; // mais longe que isso da linha = saiu da rota
const OFF_ROUTE_FIXES = 3; // quantas leituras seguidas fora antes de recalcular
const REROUTE_MIN_INTERVAL_MS = 10000;
const ARRIVAL_METERS = 35;
const VOICE_KEY = "ent-nav-voice";

function readVoicePref() {
  try {
    return localStorage.getItem(VOICE_KEY) !== "off";
  } catch {
    return true;
  }
}

function nightStyle() {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 6;
}

function arrowElement() {
  const el = document.createElement("div");
  el.className = "ent-nav-me";
  el.innerHTML = '<div class="ent-nav-me-arrow"></div>';
  return el;
}

// Navegação dentro da página do entregador: rota com trânsito, instrução
// da próxima curva, voz em português e recálculo automático. Como ele não
// sai da página, a localização continua indo pro cliente (o Google Maps
// num app separado pausaria a página).
export default function CourierNavigation({ destination, label, onClose }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const meMarkerRef = useRef(null);
  const routeRef = useRef(null);
  const lastPosRef = useRef(null);
  const headingRef = useRef(null);
  const offRouteCountRef = useRef(0);
  const lastRerouteRef = useRef(0);
  const announcedRef = useRef(new Set());
  const followRef = useRef(true);
  const voiceRef = useRef(readVoicePref());
  const arrivedRef = useRef(false);

  const [status, setStatus] = useState("locating"); // locating | routing | navigating | arrived | error
  const [error, setError] = useState("");
  const [banner, setBanner] = useState(null); // { text, distance }
  const [remaining, setRemaining] = useState(null); // { meters, seconds }
  const [following, setFollowing] = useState(true);
  const [voiceOn, setVoiceOn] = useState(voiceRef.current);

  useWakeLock(true);

  // ── Mapa ───────────────────────────────────────────────────────────
  useEffect(() => {
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: nightStyle()
        ? "mapbox://styles/mapbox/navigation-night-v1"
        : "mapbox://styles/mapbox/navigation-day-v1",
      center: [destination.lng, destination.lat],
      zoom: 15,
      attributionControl: false,
    });
    // Créditos do mapa (obrigatórios pelos termos do Mapbox), compactos
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    mapRef.current = map;

    new mapboxgl.Marker({ color: "#e11d48" }).setLngLat([destination.lng, destination.lat]).addTo(map);

    map.on("load", () => {
      map.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "route-casing",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#1e3a8a", "line-width": 11 },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#3b82f6", "line-width": 7 },
      });
      if (routeRef.current) drawRoute(routeRef.current);
    });

    map.on("error", (e) => console.error("[CourierNavigation] mapa:", e?.error?.message ?? e));

    // Arrastou o mapa → para de seguir (aparece "Centralizar")
    map.on("dragstart", () => {
      followRef.current = false;
      setFollowing(false);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drawRoute = (route) => {
    const source = mapRef.current?.getSource("route");
    source?.setData({ type: "Feature", geometry: { type: "LineString", coordinates: route.geometry } });
  };

  // ── Rota ───────────────────────────────────────────────────────────
  const loadRoute = useCallback(
    async (from) => {
      lastRerouteRef.current = Date.now();
      try {
        const route = await fetchRoute(from, destination, headingRef.current);
        routeRef.current = route;
        announcedRef.current = new Set();
        offRouteCountRef.current = 0;
        drawRoute(route);
        setStatus("navigating");
        setError("");
      } catch (e) {
        if (!routeRef.current) {
          setStatus("error");
          setError(e.message);
        }
      }
    },
    [destination],
  );

  // ── Posição ao vivo ────────────────────────────────────────────────
  const handlePosition = useCallback(
    (pos) => {
      const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const prev = lastPosRef.current;

      // Direção: a do GPS quando está andando, senão a do último trecho
      if (pos.coords.heading != null && pos.coords.speed > 1) {
        headingRef.current = pos.coords.heading;
      } else if (prev && distanceMeters(prev, here) > 8) {
        headingRef.current = bearingDegrees(prev, here);
      }
      lastPosRef.current = here;

      const map = mapRef.current;
      if (map) {
        if (!meMarkerRef.current) {
          meMarkerRef.current = new mapboxgl.Marker({ element: arrowElement(), rotationAlignment: "map" })
            .setLngLat([here.lng, here.lat])
            .addTo(map);
        }
        meMarkerRef.current.setLngLat([here.lng, here.lat]);
        if (headingRef.current != null) meMarkerRef.current.setRotation(headingRef.current);
        if (followRef.current) {
          map.easeTo({
            center: [here.lng, here.lat],
            bearing: headingRef.current ?? map.getBearing(),
            zoom: 17,
            pitch: 55,
            offset: [0, 140],
            duration: 900,
          });
        }
      }

      // Chegou?
      if (distanceMeters(here, destination) <= ARRIVAL_METERS) {
        if (!arrivedRef.current) {
          arrivedRef.current = true;
          if (voiceRef.current) speak("Você chegou ao destino.");
        }
        setStatus("arrived");
        return;
      }

      const route = routeRef.current;
      if (!route) {
        if (Date.now() - lastRerouteRef.current > 3000) {
          setStatus("routing");
          loadRoute(here);
        }
        return;
      }

      const { along, offset } = projectOnRoute(here, route.geometry, route.cum);

      // Saiu da rota → recalcula (com folga pra imprecisão do GPS)
      const accuracyOk = (pos.coords.accuracy ?? 0) < 60;
      offRouteCountRef.current = offset > OFF_ROUTE_METERS && accuracyOk ? offRouteCountRef.current + 1 : 0;
      if (
        offRouteCountRef.current >= OFF_ROUTE_FIXES &&
        Date.now() - lastRerouteRef.current > REROUTE_MIN_INTERVAL_MS
      ) {
        if (voiceRef.current) speak("Recalculando a rota.");
        loadRoute(here);
        return;
      }

      // Trecho atual e a próxima manobra
      let i = 0;
      while (i + 1 < route.stepStart.length && route.stepStart[i + 1] <= along) i++;
      const step = route.steps[i];
      const stepEnd = route.stepStart[i] + step.distance;
      const toManeuver = Math.max(0, stepEnd - along);
      const next = route.steps[i + 1];
      // Texto completo da próxima manobra ("Vire à direita na Rua X");
      // o banner do Mapbox traz só o nome da rua
      const bannerText =
        next?.maneuver?.instruction ??
        step.bannerInstructions?.[0]?.primary?.text ??
        "Siga até o destino";
      setBanner({ text: bannerText, distance: toManeuver, type: next?.maneuver?.modifier ?? "" });

      // Voz: cada aviso do trecho uma vez só, quando chega na distância dele
      if (voiceRef.current) {
        (step.voiceInstructions ?? []).forEach((v, k) => {
          const key = `${route.id}-${i}-${k}`;
          if (toManeuver <= v.distanceAlongGeometry && !announcedRef.current.has(key)) {
            announcedRef.current.add(key);
            speak(v.announcement);
          }
        });
      }

      const left = Math.max(0, route.distance - along);
      setRemaining({ meters: left, seconds: route.duration * (left / route.distance) });
    },
    [destination, loadRoute],
  );

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("error");
      setError("Este celular não informa a localização.");
      return undefined;
    }
    const watchId = navigator.geolocation.watchPosition(
      handlePosition,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus("error");
          setError("Ative a localização do navegador para navegar.");
        }
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [handlePosition]);

  // ── Ações ──────────────────────────────────────────────────────────
  const recenter = () => {
    followRef.current = true;
    setFollowing(true);
    const here = lastPosRef.current;
    if (here && mapRef.current) {
      mapRef.current.easeTo({
        center: [here.lng, here.lat],
        bearing: headingRef.current ?? 0,
        zoom: 17,
        pitch: 55,
        offset: [0, 140],
      });
    }
  };

  const toggleVoice = () => {
    const next = !voiceRef.current;
    voiceRef.current = next;
    setVoiceOn(next);
    if (!next && "speechSynthesis" in window) window.speechSynthesis.cancel();
    try {
      localStorage.setItem(VOICE_KEY, next ? "on" : "off");
    } catch {
      // sem armazenamento — vale só nesta navegação
    }
  };

  const arrivalTime =
    remaining && new Date(Date.now() + remaining.seconds * 1000).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="ent-nav">
      <div ref={containerRef} className="ent-nav-map" />

      <div className="ent-nav-top">
        {status === "navigating" && banner && (
          <div className="ent-nav-banner">
            <span className="ent-nav-banner-dist">{formatDistance(banner.distance)}</span>
            <span className="ent-nav-banner-text">{banner.text}</span>
          </div>
        )}
        {status === "locating" && <div className="ent-nav-banner">📍 Procurando sua localização…</div>}
        {status === "routing" && <div className="ent-nav-banner">🧭 Calculando a rota…</div>}
        {status === "arrived" && <div className="ent-nav-banner ent-nav-arrived">🏁 Você chegou — {label}</div>}
        {status === "error" && <div className="ent-nav-banner ent-nav-error">⚠️ {error}</div>}
      </div>

      <div className="ent-nav-side">
        <button type="button" className="ent-nav-round" onClick={toggleVoice} aria-label="Voz">
          {voiceOn ? "🔊" : "🔇"}
        </button>
        {!following && (
          <button type="button" className="ent-nav-round" onClick={recenter} aria-label="Centralizar">
            🎯
          </button>
        )}
      </div>

      <div className="ent-nav-bottom">
        <div className="ent-nav-eta">
          {remaining ? (
            <>
              <strong>{Math.max(1, Math.round(remaining.seconds / 60))} min</strong>
              <span>
                {formatDistance(remaining.meters)} · chegada {arrivalTime}
              </span>
            </>
          ) : (
            <span>{label}</span>
          )}
        </div>
        <button type="button" className="ent-nav-close" onClick={onClose}>
          Sair
        </button>
      </div>
    </div>
  );
}
