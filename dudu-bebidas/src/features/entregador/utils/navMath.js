// Contas de navegação: distância entre pontos, onde o entregador está ao
// longo da rota e direção do movimento. Coordenadas da rota no formato do
// Mapbox: [lng, lat].

const EARTH_RADIUS_M = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;

export function distanceMeters(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Direção de a até b, em graus (0 = norte, 90 = leste)
export function bearingDegrees(a, b) {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Distância acumulada (m) até cada ponto da linha da rota
export function cumulativeDistances(coords) {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    cum.push(cum[i - 1] + distanceMeters({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 }));
  }
  return cum;
}

// Ponto da rota mais perto do entregador:
//   along = quantos metros da rota ele já percorreu
//   offset = quantos metros ele está fora da linha (pra saber se saiu da rota)
// Projeção plana local — sobra precisão de sobra nas distâncias de uma entrega.
export function projectOnRoute(point, coords, cum) {
  const mPerLat = 110540;
  const mPerLng = 111320 * Math.cos(toRad(point.lat));
  const toXY = ([lng, lat]) => [(lng - point.lng) * mPerLng, (lat - point.lat) * mPerLat];

  let best = { along: 0, offset: Infinity };
  for (let i = 0; i < coords.length - 1; i++) {
    const [ax, ay] = toXY(coords[i]);
    const [bx, by] = toXY(coords[i + 1]);
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lenSq));
    const px = ax + t * dx;
    const py = ay + t * dy;
    const offset = Math.hypot(px, py);
    if (offset < best.offset) {
      best = { along: cum[i] + (cum[i + 1] - cum[i]) * t, offset };
    }
  }
  return best;
}

// "350 m" / "1,2 km"
export function formatDistance(meters) {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}
