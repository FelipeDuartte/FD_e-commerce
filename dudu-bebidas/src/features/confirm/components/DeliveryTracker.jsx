import { useEffect, useState } from "react";
import { STATUS_STEP, STEPS } from "../confirmConstants";
import DeliveryMap from "../../../shared/components/DeliveryMap/DeliveryMap";
import { estimateEtaMinutes } from "../../../shared/utils/geo";

// Se o entregador parar de mandar atualização por mais que isso (app
// fechado, sem sinal, ou pedido esquecido em "em entrega"), troca o mapa
// por um aviso — em vez de deixar um pino parado parecendo "ao vivo".
const STALE_THRESHOLD_MS = 3 * 60 * 1000;

// wa.me exige só dígitos com DDI — telefone salvo no cadastro do
// entregador pode vir com parênteses/traço/espaço.
function waLink(phone) {
  const digits = String(phone).replace(/\D/g, "");
  const withCountryCode = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountryCode}`;
}

export default function DeliveryTracker({
  status,
  statusLoading,
  animating,
  courierName,
  courierPhone,
  courierLat,
  courierLng,
  deliveryLat,
  deliveryLng,
  courierLocationUpdatedAt,
}) {
  const currentStep = STATUS_STEP[status] ?? 0;

  // O timestamp da última localização não muda enquanto ela ficar
  // desatualizada (o poll continua devolvendo o mesmo valor) — sem esse
  // "tick" próprio, o React nunca re-renderiza sozinho pra perceber que o
  // tempo passou e a mensagem de "desatualizado" precisa aparecer.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceTick((t) => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  const hasLiveLocation =
    status === "on_the_way" && typeof courierLat === "number" && typeof courierLng === "number";
  const isStale =
    hasLiveLocation &&
    courierLocationUpdatedAt != null &&
    Date.now() - new Date(courierLocationUpdatedAt).getTime() > STALE_THRESHOLD_MS;
  const hasDestination = typeof deliveryLat === "number" && typeof deliveryLng === "number";
  const etaMinutes =
    hasLiveLocation && !isStale && hasDestination
      ? estimateEtaMinutes(courierLat, courierLng, deliveryLat, deliveryLng)
      : null;

  return (
    <div className="cf-tracker-card">
      <div className="cf-tracker-header">
        <span className="cf-tracker-label">📦 Acompanhe seu pedido</span>
        {!statusLoading && (
          <span className={`cf-status-badge cf-status-${status}`}>
            {STEPS[currentStep].icon} {STEPS[currentStep].title}
          </span>
        )}
      </div>

      {statusLoading ? (
        <div className="cf-tracker-loading">
          <div className="cf-loading-bar" />
          <p>Carregando status...</p>
        </div>
      ) : (
        <>
          <div className="cf-progress-track">
            <div className="cf-progress-fill" style={{ width: `${(currentStep / 3) * 100}%` }} />
          </div>

          <div className="cf-steps">
            {STEPS.map((step, i) => {
              const isDone = i < currentStep;
              const isActive = i === currentStep;
              const isPending = i > currentStep;
              return (
                <div
                  key={i}
                  className={[
                    "cf-step",
                    isDone && "cf-step-done",
                    isActive && "cf-step-active",
                    isPending && "cf-step-pending",
                    animating && isActive && "cf-step-entering",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="cf-step-icon-wrap">
                    <div className="cf-step-icon">{isDone ? "✓" : step.icon}</div>
                    {isActive && <div className="cf-step-pulse" />}
                  </div>
                  <div className="cf-step-info">
                    <span className="cf-step-title">{step.title}</span>
                    <span className="cf-step-desc">{isActive ? step.activeDesc : step.desc}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={`cf-status-msg cf-status-msg-${status}`}>
            <span className="cf-status-msg-icon">{STEPS[currentStep].icon}</span>
            <span className="cf-status-msg-text">{STEPS[currentStep].activeDesc}</span>
          </div>

          {courierName && (
            <div className="cf-courier-info">
              <span>🛵 Seu entregador: <strong>{courierName}</strong></span>
              {courierPhone && (
                <a href={waLink(courierPhone)} target="_blank" rel="noreferrer">
                  Chamar no WhatsApp
                </a>
              )}
            </div>
          )}

          {(status === "pending" || status === "preparing") && (
            <div className="cf-map-teaser">
              <span className="cf-map-teaser-icon">📍</span>
              <p>
                <strong>Rastreamento ao vivo liberado!</strong> Assim que seu
                pedido sair pra entrega, um mapa aparece bem aqui e você
                acompanha o entregador se aproximando em tempo real.
              </p>
            </div>
          )}

          {status === "on_the_way" && (
            <div className="cf-delivery-map-wrap">
              {hasLiveLocation && isStale ? (
                <div className="cf-map-stale">
                  <span className="cf-map-stale-icon">📡</span>
                  <p>
                    Não conseguimos confirmar a localização do entregador
                    agora. Seu pedido continua a caminho — se demorar muito,
                    fale com a loja pelo WhatsApp.
                  </p>
                </div>
              ) : hasLiveLocation ? (
                <>
                  <DeliveryMap
                    markers={[
                      { lat: courierLat, lng: courierLng, emoji: "🛵", label: "Entregador" },
                      ...(hasDestination
                        ? [{ lat: deliveryLat, lng: deliveryLng, emoji: "🏠", label: "Você" }]
                        : []),
                    ]}
                  />
                  {etaMinutes && (
                    <p className="cf-eta">🕐 Chegada estimada: ~{etaMinutes} min (aproximado)</p>
                  )}
                </>
              ) : (
                // O entregador só começa a compartilhar localização quando
                // sai pra entrega — pode levar até uns 25s pro primeiro
                // ponto chegar. Sem isso aqui, a tela fica "vazia" nesse
                // meio tempo e passa a impressão de que não vai ter mapa.
                <div className="cf-map-loading">
                  <div className="cf-loading-bar" />
                  <p>🗺️ Carregando localização do entregador...</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
