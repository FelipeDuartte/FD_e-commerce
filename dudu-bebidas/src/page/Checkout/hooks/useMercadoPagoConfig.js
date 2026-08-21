import { useEffect, useState } from "react";
import { getMercadoPagoPublicConfig } from "../../../utils/mercadopagoConfig";

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
      setEnabled(enabled);
      setPublicKey(publicKey);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  return { enabled, publicKey, loaded };
}
