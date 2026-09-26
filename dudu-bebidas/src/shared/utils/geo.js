// Geocodificação (Mapbox Geocoding API) e cálculo de distância — usados na
// atribuição de entregador (geocodifica o endereço de destino uma vez, ver
// adminOrderService.js) e no ETA simples da Fase 2 (distância em linha
// reta, sem rota real — isso fica pra Fase 3).

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Mesmos campos usados em OrderCard.jsx/CourierOrderCard.jsx pra exibir o
// endereço — junta numa string só, pra geocodificação/busca externa.
export function formatAddressText(address) {
  return [address?.street, address?.number, address?.district, address?.city, address?.state]
    .filter(Boolean)
    .join(", ");
}

// Converte um endereço em texto pra {lat, lng} via Mapbox — retorna null
// em qualquer falha (endereço ruim, token ausente, API fora do ar), NUNCA
// lança: quem chama trata isso como "sem pino de mapa pra esse pedido",
// nunca como motivo pra travar a atribuição do entregador.
export async function geocodeAddress(addressText) {
  if (!MAPBOX_TOKEN || !addressText?.trim()) return null;

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(addressText)}.json?country=br&limit=1&access_token=${MAPBOX_TOKEN}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const [lng, lat] = data.features?.[0]?.center ?? [];
    return typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;
  } catch (e) {
    console.error("[geocodeAddress] erro:", e);
    return null;
  }
}

// Distância em linha reta (fórmula de Haversine), em km.
export function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ETA bem simples: distância ÷ velocidade média assumida (moto em área
// urbana) — vira minutos arredondados. Sem rota real (Fase 3).
const ASSUMED_SPEED_KMH = 25;
export function estimateEtaMinutes(lat1, lng1, lat2, lng2) {
  const km = haversineDistanceKm(lat1, lng1, lat2, lng2);
  return Math.max(1, Math.round((km / ASSUMED_SPEED_KMH) * 60));
}
