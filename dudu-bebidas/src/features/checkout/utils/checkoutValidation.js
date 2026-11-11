// Regras de validação do checkout — fora do hook/serviço pra poderem ser
// testadas sem React nem Supabase (checkoutValidation.test.js).

/**
 * Formulário da tela de checkout. Devolve a mensagem do primeiro problema
 * encontrado, ou null quando está tudo certo.
 */
export function validateCheckoutForm({ address, cep, cepError, isRetirada }) {
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
}

/** Última conferência antes de enviar o pedido pra edge function create-order. */
export function validateOrder({ paymentMethod, address, cartItems }) {
  if (!cartItems || cartItems.length === 0) return "Carrinho vazio.";
  if (!paymentMethod) return "Forma de pagamento não selecionada.";

  const isRetirada = address?.isRetirada === true;

  if (!isRetirada) {
    if (!address?.street) return "Endereço incompleto. Informe a rua.";
    if (!address?.number) return "Endereço incompleto. Informe o número.";
    if (!address?.district) return "Endereço incompleto. Informe o bairro.";
    if (!address?.cep) return "Endereço incompleto. Informe o CEP.";
    return null;
  }

  if (!address?.name) return "Informe seu nome para retirada.";
  if (!address?.phone) return "Informe seu telefone para contato.";
  return null;
}
