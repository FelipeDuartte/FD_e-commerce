export const AGE_GATE_ACCEPTED_KEY = "dudu_bebidas_age_gate_accepted";
export const COOKIE_CONSENT_KEY = "dudu_bebidas_cookie_consent";
export const LEGACY_COOKIE_CONSENT_KEY = "cookieConsent";
export const LEGACY_COOKIE_NAME = "cookie_consent";
export const TERMS_ACCEPTED_KEY = "dudu_bebidas_terms_accepted";
export const PRIVACY_ACCEPTED_KEY = "dudu_bebidas_privacy_accepted";

export function hasAcceptedAgeGate() {
  return localStorage.getItem(AGE_GATE_ACCEPTED_KEY) === "true";
}

export function acceptAgeGate() {
  const acceptedAt = new Date().toISOString();

  localStorage.setItem(AGE_GATE_ACCEPTED_KEY, "true");
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ accepted: true, acceptedAt }));
  localStorage.setItem(LEGACY_COOKIE_CONSENT_KEY, "accepted");
  localStorage.setItem(TERMS_ACCEPTED_KEY, JSON.stringify({ accepted: true, acceptedAt }));
  localStorage.setItem(PRIVACY_ACCEPTED_KEY, JSON.stringify({ accepted: true, acceptedAt }));
  document.cookie = `${LEGACY_COOKIE_NAME}=accepted; max-age=${180 * 24 * 60 * 60}; path=/; SameSite=Lax`;
}
