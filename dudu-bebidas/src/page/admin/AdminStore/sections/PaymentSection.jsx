import { useState, useEffect } from "react";
import { getPaymentConfig, updatePaymentConfig } from "../../services/adminPaymentService";
import { EMPTY_PAYMENT_CONFIG } from "../constants";

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
            mercadopago_public_key: data.mercadopago_public_key ?? "",
            mercadopago_environment: data.mercadopago_environment ?? "test",
            // Os dois campos sensíveis nunca vêm com o valor real — só a
            // flag "_set" indica se já tem algo salvo (ver adminPaymentService).
            mercadopago_access_token: "",
            mercadopago_access_token_set: data.mercadopago_access_token_set ?? false,
            mercadopago_webhook_secret: "",
            mercadopago_webhook_secret_set: data.mercadopago_webhook_secret_set ?? false,
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
      // Se um campo sensível acabou de ser digitado, marca como "_set" pra
      // já trocar o placeholder sem precisar recarregar a página.
      setConfig((prev) => ({
        ...prev,
        mercadopago_access_token_set: prev.mercadopago_access_token_set || !!prev.mercadopago_access_token,
        mercadopago_access_token: "",
        mercadopago_webhook_secret_set: prev.mercadopago_webhook_secret_set || !!prev.mercadopago_webhook_secret,
        mercadopago_webhook_secret: "",
      }));
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

      <div className="adm-store-section">
        <div className="adm-store-section-header">
          <h2 className="adm-store-section-title">Cartão de crédito online (Mercado Pago)</h2>
          <p className="adm-store-section-desc">
            Credenciais da aplicação criada no{" "}
            <a href="https://www.mercadopago.com.br/developers/panel" target="_blank" rel="noreferrer">
              painel de desenvolvedores do Mercado Pago
            </a>. Use as credenciais de <strong>teste</strong> (prefixo TEST-)
            até confirmar que tudo funciona — só depois troque pelas de produção.
          </p>
        </div>

        <div className="adm-form-row" style={{ flexWrap: "wrap" }}>
          <div className="adm-form-field">
            <label>Ambiente</label>
            <select name="mercadopago_environment" value={config.mercadopago_environment} onChange={onChange}>
              <option value="test">Teste (sandbox)</option>
              <option value="production">Produção</option>
            </select>
          </div>
          <div className="adm-form-field">
            <label>Public Key</label>
            <input
              name="mercadopago_public_key"
              value={config.mercadopago_public_key}
              onChange={onChange}
              placeholder="TEST-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </div>
          <div className="adm-form-field">
            <label>Access Token</label>
            <input
              name="mercadopago_access_token"
              type="password"
              value={config.mercadopago_access_token}
              onChange={onChange}
              placeholder={
                config.mercadopago_access_token_set
                  ? "•••••••••••••••• (já configurado — digite pra substituir)"
                  : "TEST-0000000000000000-000000-..."
              }
            />
          </div>
          <div className="adm-form-field">
            <label>Chave secreta do Webhook</label>
            <input
              name="mercadopago_webhook_secret"
              type="password"
              value={config.mercadopago_webhook_secret}
              onChange={onChange}
              placeholder={
                config.mercadopago_webhook_secret_set
                  ? "•••••••••••••••• (já configurada — digite pra substituir)"
                  : "Copie da seção Webhooks da aplicação"
              }
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
  );
}
