import { cumulativeDistances } from "../utils/navMath";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Rota de moto/carro considerando o trânsito (perfil driving-traffic do
// Mapbox), com instruções em português (texto e voz). heading = direção
// atual do entregador, pra rota não começar mandando dar meia-volta.
export async function fetchRoute(from, to, heading = null) {
  if (!MAPBOX_TOKEN) throw new Error("Mapa não configurado (faltando token do Mapbox).");

  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const params = new URLSearchParams({
    geometries: "geojson",
    overview: "full",
    steps: "true",
    language: "pt-BR",
    voice_instructions: "true",
    banner_instructions: "true",
    voice_units: "metric",
    access_token: MAPBOX_TOKEN,
  });
  if (heading != null) params.set("bearings", `${Math.round(heading)},45;`);

  const response = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?${params}`,
  );
  if (!response.ok) throw new Error("Não foi possível calcular a rota.");

  const data = await response.json();
  const route = data.routes?.[0];
  if (!route) throw new Error("Nenhuma rota encontrada até o cliente.");

  const geometry = route.geometry.coordinates;
  const steps = route.legs?.[0]?.steps ?? [];

  // Onde cada trecho começa (m desde o início da rota)
  const stepStart = [];
  let acc = 0;
  for (const step of steps) {
    stepStart.push(acc);
    acc += step.distance;
  }

  return {
    id: `${Date.now()}`,
    geometry,
    cum: cumulativeDistances(geometry),
    steps,
    stepStart,
    distance: route.distance, // m
    duration: route.duration, // s, já com trânsito
  };
}
