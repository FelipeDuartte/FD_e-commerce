import { useCallback, useEffect, useRef, useState } from "react";
import { saveOrder } from "../services/saveOrder";
import { saveMercadoPagoOrder } from "../services/saveMercadoPagoOrder";
import {
  loadLastDeliveryAddress,
  saveLastDeliveryAddress,
} from "../utils/checkoutAddressStorage";
import { INITIAL_ADDRESS, INSTALLMENT_FEE_RATE, roundCents } from "../checkoutConstants";

// Concentra todo o estado e as regras do checkout: endereço/CEP, forma de
// pagamento/parcelas, validação e o submit do pedido. O componente só
// renderiza o que este hook expõe.
export function useCheckoutForm({ user, cartItems, cartTotal, DELIVERY, isRetirada, bairroCarrinho, clearCart, navigate }) {
  const errorRef = useRef(null);
  const isProcessingRef = useRef(false);

  const [orderProcessed, setOrderProcessed] = useState(false);
  const [payment, setPayment] = useState("pix");
  const [installments, setInstallments] = useState(1);

  // Total já com a taxa da maquininha embutida (só quando for crédito)
  const baseTotal = cartTotal + DELIVERY;
  const cardFee = payment === "credit_card"
    ? roundCents(baseTotal * (INSTALLMENT_FEE_RATE[installments] ?? 0))
    : 0;
  const finalTotal = baseTotal + cardFee;
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [cep, setCep] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");

  // Bairro já escolhido no carrinho pré-preenche o campo de endereço —
  // sem isso, ficava vazio até o cliente digitar o CEP, mesmo já tendo
  // informado o bairro na etapa anterior. O CEP ainda pode sobrescrever
  // com o nome oficial do bairro vindo do ViaCEP (handleCepBlur).
  const [address, setAddress] = useState(() => ({
    ...INITIAL_ADDRESS,
    district: bairroCarrinho || "",
  }));
  const [lastAddress, setLastAddress] = useState(null);
  const [lastAddressMessage, setLastAddressMessage] = useState("");

  // ── Helpers ───────────────────────────────────────────
  const showError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => {
      if (errorRef.current) {
        errorRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
        errorRef.current.classList.add("co-error-highlight");
        setTimeout(
          () => errorRef.current?.classList.remove("co-error-highlight"),
          2000,
        );
      }
    }, 100);
  };

  // ── Effects ───────────────────────────────────────────
  useEffect(() => {
    if (cartItems.length === 0) navigate("/", { replace: true });
  }, [cartItems.length, navigate]);

  useEffect(() => {
    if (!orderProcessed) return;
    const handlePopState = () => navigate("/", { replace: true });
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [orderProcessed, navigate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!user?.id || isRetirada) {
        setLastAddress(null);
        return;
      }

      const savedAddress = loadLastDeliveryAddress(user.id);
      const sameDeliveryArea =
        savedAddress &&
        (!savedAddress.bairro || savedAddress.bairro === bairroCarrinho);

      setLastAddress(sameDeliveryArea ? savedAddress : null);
    }, 0);
    return () => clearTimeout(timer);
  }, [bairroCarrinho, isRetirada, user?.id]);

  // ── Handlers ──────────────────────────────────────────
  const handleAddressChange = (e) => {
    setAddress((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setLastAddressMessage("");
    if (errorMsg) setErrorMsg("");
  };

  const handleCepChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 8);
    setCep(value.length > 5 ? `${value.slice(0, 5)}-${value.slice(5)}` : value);
    setCepError("");
    setLastAddressMessage("");
    if (errorMsg) setErrorMsg("");
  };

  const handleCepBlur = async () => {
    const cleaned = cep.replace(/\D/g, "");
    if (cleaned.length !== 8) {
      setCepError("CEP inválido. Digite 8 números.");
      return;
    }
    setCepLoading(true);
    setCepError("");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
      const data = await res.json();
      if (data.erro) {
        setCepError("CEP não encontrado.");
        setCepLoading(false);
        return;
      }
      setAddress((prev) => ({
        ...prev,
        street: data.logradouro || prev.street,
        district: data.bairro || prev.district,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }));
    } catch {
      setCepError("Erro ao buscar CEP.");
    }
    setCepLoading(false);
  };

  const handlePhoneChange = (e) => {
    let value = e.target.value.replace(/\D/g, "").slice(0, 11);
    if (value.length > 6)
      value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    else if (value.length > 2)
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    setAddress((prev) => ({ ...prev, phone: value }));
    setLastAddressMessage("");
    if (errorMsg) setErrorMsg("");
  };

  const handleUseLastAddress = () => {
    if (!lastAddress) return;

    setAddress({
      ...INITIAL_ADDRESS,
      ...lastAddress,
    });
    setCep(lastAddress.cep ?? "");
    setCepError("");
    setErrorMsg("");
    setLastAddressMessage("Ultima localizacao aplicada.");
  };

  // ── Validação ─────────────────────────────────────────
  const validateForm = () => {
    if (!address.name.trim()) return "Por favor, informe seu nome.";

    const phoneDigits = address.phone.replace(/\D/g, "");
    if (!phoneDigits || phoneDigits.length < 10)
      return "Por favor, informe um telefone válido com DDD.";

    if (isRetirada) return null;

    const cepDigits = cep.replace(/\D/g, "");
    if (cepDigits.length !== 8) return "Por favor, informe um CEP válido.";
    if (cepError) return "Por favor, verifique o CEP informado.";
    if (!address.street.trim()) return "Por favor, informe o endereço.";
    if (!address.number.trim()) return "Por favor, informe o número.";
    if (!address.district.trim()) return "Por favor, informe o bairro.";

    return null;
  };

  // ── Submit ────────────────────────────────────────────
  const handleConfirmOrder = async () => {
    if (isProcessingRef.current || orderProcessed || loading) return;
    setErrorMsg("");

    const validationError = validateForm();
    if (validationError) {
      showError(validationError);
      return;
    }

    if (cartItems.length === 0) {
      showError("Seu carrinho está vazio.");
      return;
    }

    isProcessingRef.current = true;
    setLoading(true);

    try {
      const addressToSave = isRetirada
        ? { name: address.name, phone: address.phone, isRetirada: true }
        : { ...address, cep, bairro: bairroCarrinho };

      const { orderId, orderNumber, error } = await saveOrder({
        userId: user?.id ?? null,
        total: finalTotal,
        deliveryFee: DELIVERY,
        paymentMethod: payment,
        installments: payment === "credit_card" ? installments : null,
        address: addressToSave,
        cartItems,
      });

      if (error) {
        showError(error);
        isProcessingRef.current = false;
        setLoading(false);
        return;
      }

      if (user?.id && !isRetirada) {
        saveLastDeliveryAddress(user.id, addressToSave);
      }

      setOrderProcessed(true);
      clearCart();
      navigate("/confirmacao", {
        state: {
          orderId,
          orderNumber,
          cartItems,
          total: finalTotal,
          payment,
          installments: payment === "credit_card" ? installments : null,
          address: addressToSave,
          isRetirada,
        },
        replace: true,
      });
    } catch (err) {
      console.error("Erro ao processar pedido:", err);
      showError("Ocorreu um erro ao processar seu pedido. Tente novamente.");
      isProcessingRef.current = false;
      setLoading(false);
    }
  };

  // ── Submit via Mercado Pago (Card Payment Brick) ───────
  // Chamado pelo onSubmit do próprio Brick, já com o cartão tokenizado —
  // não existe botão "Confirmar Pedido" nesse caminho, o botão é o do Brick.
  //
  // Precisa de identidade de função ESTÁVEL entre renders (por isso o
  // padrão de ref abaixo, em vez de só useCallback): o SDK do Card Payment
  // Brick usa a referência de onSubmit como dependência interna pra saber
  // quando reinicializar o iframe seguro. Como esse componente reagia a
  // toda letra digitada em QUALQUER campo do formulário (nome, endereço,
  // etc — tudo re-renderiza o Checkout inteiro), uma função recriada a
  // cada render fazia o Brick reiniciar em loop, piscando e impedindo
  // digitar no cartão. Com a ref, a função exposta nunca muda de
  // identidade, mas sempre executa a versão mais recente da lógica.
  const handleMercadoPagoSubmitImpl = async (cardData) => {
    if (isProcessingRef.current || orderProcessed || loading) return;
    setErrorMsg("");

    const validationError = validateForm();
    if (validationError) {
      showError(validationError);
      return;
    }

    isProcessingRef.current = true;
    setLoading(true);

    try {
      const addressToSave = isRetirada
        ? { name: address.name, phone: address.phone, isRetirada: true }
        : { ...address, cep, bairro: bairroCarrinho };

      const { orderId, orderNumber, paymentStatus, total: chargedTotal, error } = await saveMercadoPagoOrder({
        address: addressToSave,
        cartItems,
        cardData,
        deliveryFee: DELIVERY,
      });

      if (error) {
        showError(error);
        isProcessingRef.current = false;
        setLoading(false);
        return;
      }

      if (paymentStatus === "rejected") {
        showError("Pagamento recusado pela operadora do cartão. Tente outro cartão ou forma de pagamento.");
        isProcessingRef.current = false;
        setLoading(false);
        return;
      }

      if (user?.id && !isRetirada) {
        saveLastDeliveryAddress(user.id, addressToSave);
      }

      setOrderProcessed(true);
      clearCart();
      navigate("/confirmacao", {
        state: {
          orderId,
          orderNumber,
          cartItems,
          // total real cobrado, com a taxa do Mercado Pago já embutida
          // (calculada no servidor conforme o parcelamento escolhido dentro
          // do Brick — pode ser diferente de finalTotal, que é só a
          // estimativa sem taxa mostrada antes do cliente escolher).
          total: chargedTotal ?? finalTotal,
          payment: "mercadopago_card",
          installments: cardData.installments,
          address: addressToSave,
          isRetirada,
        },
        replace: true,
      });
    } catch (err) {
      console.error("Erro ao processar pagamento:", err);
      showError("Ocorreu um erro ao processar o pagamento. Tente novamente.");
      isProcessingRef.current = false;
      setLoading(false);
    }
  };

  const handleMercadoPagoSubmitRef = useRef(handleMercadoPagoSubmitImpl);
  // Atualiza a ref num efeito, não direto no corpo do render — mutar
  // ref.current durante o render é proibido (quebra a pureza exigida por
  // renderização concorrente); só precisa estar atualizada antes do
  // próximo clique no botão do Brick, então useEffect simples já resolve.
  useEffect(() => {
    handleMercadoPagoSubmitRef.current = handleMercadoPagoSubmitImpl;
  });
  const handleMercadoPagoSubmit = useCallback(
    (cardData) => handleMercadoPagoSubmitRef.current(cardData),
    [],
  );

  // ── Derivados ─────────────────────────────────────────
  const isDisabled = loading || orderProcessed;
  const phoneDigits = address.phone.replace(/\D/g, "");
  const cepDigits = cep.replace(/\D/g, "");

  const ctaLabel = loading
    ? "Processando..."
    : orderProcessed
      ? "Confirmado ✓"
      : isRetirada
        ? "Confirmar Retirada →"
        : "Confirmar Pedido →";

  return {
    errorRef, payment, setPayment, installments, setInstallments,
    baseTotal, cardFee, finalTotal, loading, errorMsg, setErrorMsg,
    cep, cepLoading, cepError, address, lastAddress, lastAddressMessage,
    handleAddressChange, handleCepChange, handleCepBlur, handlePhoneChange,
    handleUseLastAddress, handleConfirmOrder, handleMercadoPagoSubmit,
    isDisabled, phoneDigits, cepDigits, ctaLabel,
  };
}
