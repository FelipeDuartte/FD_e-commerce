import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./DeliveryMap.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Marcador em emoji via divIcon — evita o problema clássico de Leaflet +
// bundler (os ícones padrão em PNG referenciam caminhos relativos que
// quebram depois do build), sem precisar importar/copiar assets.
function emojiIcon(emoji) {
  return L.divIcon({
    html: `<span class="delivery-map-pin">${emoji}</span>`,
    className: "delivery-map-icon",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

// Mapa fino sobre Leaflet vanilla (sem react-leaflet) — recebe só a lista
// de marcadores e cuida de criar/atualizar/destruir a instância. Usado na
// confirmação do cliente (entregador + destino) e no mapa geral do admin
// (todos os entregadores ativos).
export default function DeliveryMap({ markers, height = 260 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerLayerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current, { attributionControl: false });

    if (MAPBOX_TOKEN) {
      L.tileLayer(
        `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
        { tileSize: 512, zoomOffset: -1, maxZoom: 19 },
      ).addTo(mapRef.current);
    }

    markerLayerRef.current = L.layerGroup().addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markerLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const points = (markers ?? []).filter((m) => typeof m.lat === "number" && typeof m.lng === "number");

    points.forEach((m) => {
      const marker = L.marker([m.lat, m.lng], { icon: emojiIcon(m.emoji ?? "📍") });
      if (m.label) marker.bindTooltip(m.label, { permanent: false, direction: "top" });
      marker.addTo(layer);
    });

    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 15);
    } else if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [32, 32] });
    } else {
      map.setView([-14.235, -51.9253], 4); // Brasil, fallback sem nenhum ponto ainda
    }
  }, [markers]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="delivery-map-missing-token" style={{ height }}>
        🗺️ Mapa não configurado (faltando token do Mapbox).
      </div>
    );
  }

  return <div ref={containerRef} className="delivery-map" style={{ height }} />;
}
