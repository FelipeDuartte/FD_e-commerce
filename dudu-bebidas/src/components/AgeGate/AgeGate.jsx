import { useEffect, useState } from "react";
import { acceptAgeGate } from "./ageGateStorage";
import "./AgeGate.css";

export default function AgeGate({ onAccept }) {
  const [rejected, setRejected] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const handleAccept = () => {
    acceptAgeGate();
    onAccept();
  };

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
            <button className="age-gate__button age-gate__button--yes" type="button" onClick={handleAccept}>
              Sim
            </button>
            <button className="age-gate__button age-gate__button--no" type="button" onClick={() => setRejected(true)}>
              Não
            </button>
          </div>

          {rejected && (
            <p className="age-gate__denied" role="alert">
              Para acessar a Dudu Bebidas, é necessário confirmar que você é maior de 18 anos.
            </p>
          )}

          <p className="age-gate__legal">
            Ao clicar em <strong>Sim</strong>, você aceita o uso de cookies, nossos{" "}
            <a href="/terms-service" target="_blank" rel="noreferrer">
              Termos de Serviço
            </a>{" "}
            e nossa{" "}
            <a href="/privacy-policy" target="_blank" rel="noreferrer">
              Política de Privacidade
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
