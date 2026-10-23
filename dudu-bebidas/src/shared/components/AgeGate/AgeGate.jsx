import { useEffect, useState } from "react";
import { acceptAgeGate } from "./ageGateStorage";
import { getCurrentStore } from "../../supabase/Supabaseclient";
import "./AgeGate.css";

// requireAge (stores.age_gate): loja de bebidas → tela cheia "maior de 18?".
// Sem isso → só a faixa de cookies/termos no rodapé, sem bloquear o site.
// Nos dois casos o aceite registra cookies, termos e privacidade (LGPD).
export default function AgeGate({ requireAge, onAccept }) {
  const handleAccept = () => {
    acceptAgeGate();
    onAccept();
  };

  return requireAge
    ? <AgeCheck onAccept={handleAccept} />
    : <ConsentBanner onAccept={handleAccept} />;
}

function LegalLinks() {
  return (
    <>
      <a href="/terms-service" target="_blank" rel="noreferrer">
        Termos de Serviço
      </a>{" "}
      e nossa{" "}
      <a href="/privacy-policy" target="_blank" rel="noreferrer">
        Política de Privacidade
      </a>
    </>
  );
}

function AgeCheck({ onAccept }) {
  const [rejected, setRejected] = useState(false);
  const storeName = getCurrentStore()?.name || "esta loja";

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="age-gate" role="dialog" aria-modal="true" aria-labelledby="age-gate-title">
      <div className="age-gate__scrim" />

      <div className="age-gate__content">
        <p className="age-gate__warning">
          Você deve ser maior de idade para comprar e consumir álcool neste site
        </p>

        <section className="age-gate__modal">
          <h2 id="age-gate-title">Bem Vindo!!!</h2>
          <p className="age-gate__question">Sua idade é maior que 18 anos?</p>

          <div className="age-gate__actions">
            <button className="age-gate__button age-gate__button--yes" type="button" onClick={onAccept}>
              Sim
            </button>
            <button className="age-gate__button age-gate__button--no" type="button" onClick={() => setRejected(true)}>
              Não
            </button>
          </div>

          {rejected && (
            <p className="age-gate__denied" role="alert">
              Para acessar a {storeName}, é necessário confirmar que você é maior de 18 anos.
            </p>
          )}

          <p className="age-gate__legal">
            Ao clicar em <strong>Sim</strong>, você aceita o uso de cookies, nossos <LegalLinks />.
          </p>
        </section>
      </div>
    </div>
  );
}

function ConsentBanner({ onAccept }) {
  return (
    <div className="consent-banner" role="region" aria-label="Aviso de cookies">
      <p className="consent-banner__text">
        Usamos cookies para o site funcionar. Ao continuar, você aceita nossos <LegalLinks />.
      </p>
      <button className="consent-banner__button" type="button" onClick={onAccept}>
        Aceitar
      </button>
    </div>
  );
}
