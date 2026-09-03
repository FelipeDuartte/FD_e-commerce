import { useState, useEffect } from "react";
import { getStoreConfig, updateStoreConfig } from "../../services/storeConfigService";
import { PAYMENT_METHODS } from "../../../../../shared/utils/paymentMethods";

// Só as formas que realmente aparecem no checkout do site (ver
// deliveryPaymentOptions/onlinePaymentOptions em checkoutConstants.js) —
// "fiado" é exclusivo do PDV e nunca é exibido aqui.
const TOGGLEABLE_METHODS = ["pix", "pix_entrega", "debit_card", "credit_card", "cash", "mercadopago_card"];

export default function PaymentMethodsToggleSection() {
  const [methods, setMethods] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const cfg = await getStoreConfig();
        if (!cancelled) {
          const saved = cfg?.payment_methods_enabled ?? {};
          // Método sem entrada salva ainda conta como ligado (default de
          // quem nunca mexeu aqui é "tudo ligado", igual já funciona hoje).
          setMethods(Object.fromEntries(TOGGLEABLE_METHODS.map((m) => [m, saved[m] !== false])));
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const toggle = (method) => setMethods((prev) => ({ ...prev, [method]: !prev[method] }));

  const handleSave = async () => {
    setSaving(true); setError(""); setSuccess("");
    try {
      await updateStoreConfig({ payment_methods_enabled: methods });
      setSuccess("Métodos de pagamento salvos!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  if (loading || !methods) return (
    <div className="adm-store-section">
      <div className="adm-loading"><div className="adm-spinner" /><p>Carregando...</p></div>
    </div>
  );

  return (
    <div className="adm-store-section">
      <div className="adm-store-section-header">
        <h2 className="adm-store-section-title">Métodos de pagamento no checkout</h2>
        <p className="adm-store-section-desc">
          Escolha quais formas de pagamento o cliente pode escolher no site.
          Desligar aqui não apaga nada — só some da tela de checkout.
        </p>
      </div>

      {error   && <div className="adm-modal-error">⚠️ {error}</div>}
      {success && <div className="adm-store-success">✅ {success}</div>}

      <div className="adm-store-global-flags">
        {TOGGLEABLE_METHODS.map((method) => (
          <label className="adm-store-flag-row" key={method}>
            <div className="adm-store-flag-info">
              <span className="adm-store-flag-label">
                {PAYMENT_METHODS[method].icon} {PAYMENT_METHODS[method].label}
              </span>
              {method === "mercadopago_card" && (
                <span className="adm-store-flag-desc">
                  Só aparece de verdade se as credenciais do Mercado Pago também estiverem configuradas abaixo.
                </span>
              )}
            </div>
            <div
              className={`adm-store-toggle ${methods[method] ? "on" : "off"}`}
              onClick={() => toggle(method)}
              role="switch" aria-checked={methods[method]} tabIndex={0}
              onKeyDown={(e) => e.key === " " && toggle(method)}
            >
              <span className="adm-store-toggle-thumb" />
            </div>
          </label>
        ))}
      </div>

      <div className="adm-store-hours-save">
        <button className="adm-btn-new-product" type="button" onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "💾 Salvar métodos"}
        </button>
      </div>
    </div>
  );
}
