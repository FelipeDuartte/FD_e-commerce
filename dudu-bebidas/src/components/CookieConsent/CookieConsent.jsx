import { useState } from "react";
import { Link } from "react-router-dom";
import "./CookieConsent.css";

const STORAGE_KEY = "cookieConsent";
const COOKIE_NAME = "cookie_consent";
const COOKIE_MAX_AGE_DAYS = 180;

function setConsentCookie(value) {
  const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
  document.cookie = `${COOKIE_NAME}=${value}; max-age=${maxAge}; path=/; SameSite=Lax`;
}

function readConsent() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveConsent(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // localStorage indisponível (modo privado, etc.) — segue sem persistir
  }
  setConsentCookie(value);
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(() => !readConsent());
  const [showPrefs, setShowPrefs] = useState(false);

  const acceptAll = () => {
    saveConsent("accepted");
    setVisible(false);
  };

  const rejectNonEssential = () => {
    saveConsent("rejected");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cc-banner" role="dialog" aria-live="polite" aria-label="Aviso de cookies">
      <div className="cc-content">
        <p className="cc-text">
          🍪 Usamos cookies para melhorar sua experiência, manter seu
          carrinho e sessão de login, e analisar o uso do site. Você pode
          aceitar todos os cookies ou apenas os essenciais para o
          funcionamento da loja. Saiba mais na nossa{" "}
          <Link to="/privacy-policy" className="cc-link">
            Política de Privacidade
          </Link>
          .
        </p>

        {showPrefs && (
          <div className="cc-prefs">
            <div className="cc-pref-item">
              <span className="cc-pref-title">Essenciais</span>
              <span className="cc-pref-desc">
                Necessários para login, carrinho e checkout. Não podem ser
                desativados.
              </span>
              <span className="cc-pref-badge">Sempre ativos</span>
            </div>
            <div className="cc-pref-item">
              <span className="cc-pref-title">Análise / preferências</span>
              <span className="cc-pref-desc">
                Ajudam a entender como você usa o site e a lembrar suas
                preferências.
              </span>
            </div>
          </div>
        )}

        <div className="cc-actions">
          <button
            type="button"
            className="cc-btn cc-btn-link"
            onClick={() => setShowPrefs((v) => !v)}
          >
            {showPrefs ? "Ocultar detalhes" : "Personalizar"}
          </button>
          <button
            type="button"
            className="cc-btn cc-btn-secondary"
            onClick={rejectNonEssential}
          >
            Rejeitar não essenciais
          </button>
          <button
            type="button"
            className="cc-btn cc-btn-primary"
            onClick={acceptAll}
          >
            Aceitar todos
          </button>
        </div>
      </div>
    </div>
  );
}