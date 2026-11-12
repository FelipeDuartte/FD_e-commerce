import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, getCurrentStoreId } from "../../../shared/supabase/Supabaseclient";

const ONLINE_FN = "infinitepay-checkout";
const redirectedKey = (orderId) => `infinitepay-redirected-${orderId}`;

function safeSession(fn, fallback = null) {
  try {
    return fn(window.sessionStorage);
  } catch {
    return fallback;
  }
}

/** Parâmetros que a InfinitePay põe na URL quando o cliente volta. */
export function readReturnParams(search) {
  const params = new URLSearchParams(search);
  const transactionNsu = params.get("transaction_nsu");
  const slug = params.get("slug") ?? params.get("invoice_slug");
  const orderNsu = params.get("order_nsu");
  return transactionNsu && slug ? { transactionNsu, slug, orderNsu } : null;
}

/**
 * Pagamento online (InfinitePay) na página de confirmação:
 *   - 1ª vez com o pedido aguardando: leva direto pra página de pagamento;
 *   - cliente voltou depois de pagar (parâmetros na URL): confere na hora;
 *   - voltou sem pagar: mostra "Pagar agora" (mesmo link, vale 30 min).
 * Quem confirma de verdade é o servidor (aviso da InfinitePay ou a
 * conferência daqui); a tela só reflete o payment_status do polling.
 */
export function useInfinitePayPayment({ orderId, active }) {
  const [starting, setStarting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const checkedRef = useRef(false);

  const payNow = useCallback(async () => {
    if (!orderId) return;
    setStarting(true);
    setError("");
    const { data, error: fnError } = await supabase.functions.invoke(ONLINE_FN, {
      body: { action: "create", orderId, storeId: getCurrentStoreId() },
    });
    if (fnError || data?.error || !data?.url) {
      // FunctionsHttpError não traz o corpo em `data` — busca a mensagem do servidor
      let message = data?.error;
      if (!message && fnError?.context?.json) {
        message = await fnError.context.json().then((b) => b?.error).catch(() => null);
      }
      if (data?.paid) return setStarting(false); // já pago — o polling atualiza a tela
      setError(message || "Não foi possível abrir o pagamento. Tente novamente.");
      setStarting(false);
      return;
    }
    safeSession((s) => s.setItem(redirectedKey(orderId), "1"));
    window.location.assign(data.url);
  }, [orderId]);

  // Volta da InfinitePay: confere o pagamento e limpa a URL
  useEffect(() => {
    if (!orderId || checkedRef.current) return;
    const ret = readReturnParams(window.location.search);
    if (!ret || (ret.orderNsu && ret.orderNsu !== orderId)) return;
    checkedRef.current = true;
    const timer = setTimeout(() => {
      setChecking(true);
      supabase.functions
        .invoke(ONLINE_FN, {
          body: { action: "check", orderId, storeId: getCurrentStoreId(), transactionNsu: ret.transactionNsu, slug: ret.slug },
        })
        .finally(() => {
          setChecking(false);
          window.history.replaceState(window.history.state, "", window.location.pathname);
        });
    }, 0);
    return () => clearTimeout(timer);
  }, [orderId]);

  // 1ª vez aguardando pagamento: vai direto pra InfinitePay (uma vez só por
  // aba — se o cliente voltar sem pagar, fica o botão "Pagar agora")
  useEffect(() => {
    if (!active || !orderId) return;
    if (readReturnParams(window.location.search)) return;
    if (safeSession((s) => s.getItem(redirectedKey(orderId)))) return;
    const timer = setTimeout(payNow, 0);
    return () => clearTimeout(timer);
  }, [active, orderId, payNow]);

  return { starting, checking, error, payNow };
}
