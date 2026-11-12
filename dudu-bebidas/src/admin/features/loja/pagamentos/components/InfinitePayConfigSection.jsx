import { useEffect, useState } from "react";
import { getInfinitePayConfig, updateInfinitePayConfig } from "../services/paymentConfigService";

// Pagamento online pela InfinitePay: com a InfiniteTag e a chave da API
// salvas, o checkout troca o Pix manual por "Pix ou cartão online"
// (confirmação automática). Sem elas, o site segue com o Pix manual.
export default function InfinitePayConfigSection() {
  const [handle, setHandle] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiKeySet, setApiKeySet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = async () => {
    const data = await getInfinitePayConfig();
    setHandle(data.handle);
    setApiKeySet(data.apiKeySet);
  };

  useEffect(() => {
    let cancelled = false;
    getInfinitePayConfig()
      .then((data) => {
        if (cancelled) return;
        setHandle(data.handle);
        setApiKeySet(data.apiKeySet);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const save = async (options = {}) => {
    setSaving(true); setError(""); setSuccess("");
    try {
      await updateInfinitePayConfig({ handle, apiKey, ...options });
      setApiKey("");
      await load();
      setSuccess(options.disable ? "Pagamento online desligado." : "InfinitePay salva!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!handle.trim()) return setError("Informe a InfiniteTag da loja.");
    if (!apiKeySet && !apiKey.trim()) return setError("Informe a chave da API (começa com inchk_).");
    save();
  };

  if (loading) return (
    <div className="adm-store-section">
      <div className="adm-loading"><div className="adm-spinner" /><p>Carregando...</p></div>
    </div>
  );

  const active = Boolean(handle) && apiKeySet;

  return (
    <form onSubmit={handleSubmit}>
      <div className="adm-store-section">
        <div className="adm-store-section-header">
          <h2 className="adm-store-section-title">Pagamento online (InfinitePay) {active ? "· ✅ ligado" : ""}</h2>
        </div>

        {error && <div className="adm-modal-error">⚠️ {error}</div>}
        {success && <div className="adm-store-success">✅ {success}</div>}

        <div className="adm-form-row" style={{ flexWrap: "wrap" }}>
          <div className="adm-form-field">
            <label>InfiniteTag</label>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="Ex: dudubebidas (sem o $)"
              autoComplete="off"
            />
          </div>
          <div className="adm-form-field">
            <label>Chave da API</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={apiKeySet ? "•••••••• já configurada (digite só pra trocar)" : "inchk_..."}
              autoComplete="new-password"
            />
          </div>
        </div>
      </div>

      <div className="adm-store-hours-save">
        {active && (
          <button
            type="button"
            className="adm-btn-cancel-inline"
            disabled={saving}
            onClick={() => save({ disable: true })}
            style={{ marginRight: 8 }}
          >
            Desligar pagamento online
          </button>
        )}
        <button className="adm-btn-new-product" type="submit" disabled={saving}>
          {saving ? "Salvando..." : "💾 Salvar"}
        </button>
      </div>
    </form>
  );
}
