import { useEffect, useRef } from "react";
import { initMercadoPago, CardPayment } from "@mercadopago/sdk-react";

// Componente pronto do Mercado Pago (Card Payment Brick) — coleta os dados
// do cartão (número, validade, CVV, nome, CPF/CNPJ, e-mail) num formulário
// PCI-compliant deles mesmo; o número do cartão nunca passa pelo nosso
// servidor, só o token gerado no onSubmit.
export default function MercadoPagoCardBrick({ publicKey, amount, onSubmit, onError, disabled }) {
  const initedKeyRef = useRef(null);

  useEffect(() => {
    if (!publicKey || initedKeyRef.current === publicKey) return;
    initMercadoPago(publicKey, { locale: "pt-BR" });
    initedKeyRef.current = publicKey;
  }, [publicKey]);

  if (!publicKey || amount <= 0) return null;

  return (
    <div className={disabled ? "co-mp-brick co-mp-brick-disabled" : "co-mp-brick"}>
      <CardPayment
        key={amount}
        initialization={{ amount }}
        onSubmit={onSubmit}
        onError={onError}
      />
    </div>
  );
}
