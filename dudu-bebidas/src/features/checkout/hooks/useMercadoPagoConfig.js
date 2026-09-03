import { useEffect, useState } from "react";
import { getMercadoPagoPublicConfig } from "../utils/mercadopagoConfig";

// Kill switch temporário: a conta do Mercado Pago está recusando pagamentos
// reais (análise de risco de conta de produção recém-ativada, ver conversa
// com o suporte deles) — esconde "Cartão de crédito online" do checkout até
// resolver, sem mexer nas credenciais salvas nem no resto do código. É só
// virar pra true de novo quando confirmar que os pagamentos aprovam.
const SHOW_MERCADOPAGO_CARD_OPTION = true;

// Só oferece "Cartão de crédito online" no checkout se a loja já configurou
// as duas credenciais do Mercado Pago (Public Key + Access Token) — ver
// PaymentSection.jsx no admin e migration 0007.
export function useMercadoPagoConfig() {
  const [enabled, setEnabled] = useState(false);
  const [publicKey, setPublicKey] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMercadoPagoPublicConfig().then(({ enabled, publicKey }) => {
      if (cancelled) return;
      setEnabled(SHOW_MERCADOPAGO_CARD_OPTION && enabled);
      setPublicKey(publicKey);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  return { enabled, publicKey, loaded };
}
