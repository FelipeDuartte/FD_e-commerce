import { STATUS_STEP, STEPS } from "../confirmConstants";

export default function DeliveryTracker({ status, statusLoading, animating }) {
  const currentStep = STATUS_STEP[status] ?? 0;

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
        </>
      )}
    </div>
  );
}
