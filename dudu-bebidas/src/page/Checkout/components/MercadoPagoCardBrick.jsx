import { useEffect, useMemo, useRef } from "react";
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

  // O SDK usa a referência de "initialization" como dependência interna pra
  // decidir quando reinicializar o Brick — um objeto literal inline
  // (`{ amount }`) nasceria novo a cada render do Checkout (qualquer campo
  // digitado, não só o cartão) e reiniciaria o iframe seguro em loop,
  // travando a digitação. Memoizado, só muda quando o valor real muda.
  const initialization = useMemo(() => ({ amount }), [amount]);

  if (!publicKey || amount <= 0) return null;

  return (
    <div className={disabled ? "co-mp-brick co-mp-brick-disabled" : "co-mp-brick"}>
      <div className="co-mp-fee-notice">
        <p className="co-mp-fee-notice-title">
          💳 Taxa do Mercado Pago incluída no valor final
        </p>
        <p className="co-mp-fee-notice-text">
          O valor exibido acima no parcelamento é uma estimativa — a cobrança
          real inclui a taxa do Mercado Pago e pode variar conforme o número
          de parcelas escolhido:
        </p>
        <ul className="co-mp-fee-notice-list">
          <li>À vista — 4,98%</li>
          <li>2x a 6x — 2,99%</li>
          <li>7x a 12x — 3,09%</li>
          <li>13x a 18x — 3,19%</li>
        </ul>
        <p className="co-mp-fee-notice-text">
          O valor final cobrado aparece confirmado na próxima tela, depois do pagamento.
        </p>
      </div>
      <CardPayment
        key={amount}
        initialization={initialization}
        onSubmit={onSubmit}
        onError={onError}
      />
    </div>
  );
}
