import { useState, useEffect } from "react";
import { getPaymentConfig, updatePaymentConfig } from "../../services/adminPaymentService";
import { getStoreConfig, updateStoreConfig } from "../../services/adminStoreService";
import { PAYMENT_METHODS } from "../../../../utils/paymentMethods";
import { EMPTY_PAYMENT_CONFIG } from "../constants";

// Só as formas que realmente aparecem no checkout do site (ver
// deliveryPaymentOptions/onlinePaymentOptions em checkoutConstants.js) —
// "fiado" é exclusivo do PDV e nunca é exibido aqui.
const TOGGLEABLE_METHODS = ["pix", "pix_entrega", "debit_card", "credit_card", "cash", "mercadopago_card"];

function PaymentMethodsToggleSection() {
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

export default function PaymentSection() {
  const [config, setConfig]   = useState(EMPTY_PAYMENT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await getPaymentConfig();
        if (!cancelled && data) {
          setConfig({
            pix_key: data.pix_key ?? "",
            pix_key_type: data.pix_key_type ?? "cpf",
            pix_merchant_name: data.pix_merchant_name ?? "",
            pix_merchant_city: data.pix_merchant_city ?? "",
          });
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const onChange = ({ target: { name, value } }) =>
    setConfig((prev) => ({ ...prev, [name]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true); setError(""); setSuccess("");
    try {
      await updatePaymentConfig(config);
      setSuccess("Configuração de pagamento salva!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="adm-store-section">
      <div className="adm-loading"><div className="adm-spinner" /><p>Carregando...</p></div>
    </div>
  );

  return (
    <>
      <PaymentMethodsToggleSection />

      <form onSubmit={handleSave}>
      <div className="adm-store-section">
        <div className="adm-store-section-header">
          <h2 className="adm-store-section-title">Pix</h2>
          <p className="adm-store-section-desc">
            Chave Pix da loja — usada pra gerar o QR Code e o código copia-e-cola
            no checkout. O pagamento é confirmado manualmente por você (aba
            Pedidos), não existe integração automática ainda.
          </p>
        </div>

        {error   && <div className="adm-modal-error">⚠️ {error}</div>}
        {success && <div className="adm-store-success">✅ {success}</div>}

        <div className="adm-form-row" style={{ flexWrap: "wrap" }}>
          <div className="adm-form-field">
            <label>Tipo da chave</label>
            <select name="pix_key_type" value={config.pix_key_type} onChange={onChange}>
              <option value="cpf">CPF</option>
              <option value="cnpj">CNPJ</option>
              <option value="email">E-mail</option>
              <option value="telefone">Telefone</option>
              <option value="aleatoria">Chave aleatória</option>
            </select>
          </div>
          <div className="adm-form-field">
            <label>Chave Pix</label>
            <input
              name="pix_key"
              value={config.pix_key}
              onChange={onChange}
              placeholder={
                config.pix_key_type === "telefone"
                  ? "Ex: (31) 99999-8888 — pode digitar com ou sem formatação"
                  : "Digite a chave exatamente como cadastrada no banco"
              }
            />
            {config.pix_key_type === "telefone" && (
              <span className="adm-store-hours-hint">
                Não precisa digitar o +55 — o sistema ajusta o formato automaticamente.
              </span>
            )}
          </div>
          <div className="adm-form-field">
            <label>Nome do recebedor (aparece no QR)</label>
            <input
              name="pix_merchant_name"
              value={config.pix_merchant_name}
              onChange={onChange}
              placeholder="Máx. 25 caracteres, sem acento"
              maxLength={25}
            />
          </div>
          <div className="adm-form-field">
            <label>Cidade do recebedor</label>
            <input
              name="pix_merchant_city"
              value={config.pix_merchant_city}
              onChange={onChange}
              placeholder="Máx. 15 caracteres, sem acento"
              maxLength={15}
            />
          </div>
        </div>
      </div>

      <div className="adm-store-hours-save">
        <button className="adm-btn-new-product" type="submit" disabled={saving}>
          {saving ? "Salvando..." : "💾 Salvar"}
        </button>
      </div>
      </form>
    </>
  );
}
