import { useCallback, useEffect, useRef, useState } from "react";
import {
  getOpenCashSession,
  openCashSession,
  closeCashSession,
} from "../services/cashSessionService";
import { useCashSessionRealtime } from "./useCashSessionRealtime";

export function useCashSession() {
  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [openingAmountInput, setOpeningAmountInput] = useState("");
  const [openingSession, setOpeningSession] = useState(false);
  const [sessionError, setSessionError] = useState("");

  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [declaredAmountInput, setDeclaredAmountInput] = useState("");
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState("");
  const [closeResult, setCloseResult] = useState(null);

  // silent: recarrega sem a tela de "Verificando caixa..." — essa tela
  // desmonta o resto do PDV, inclusive a janela do fechamento de caixa.
  const loadSession = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setSessionLoading(true);
    try {
      setSession(await getOpenCashSession());
      setSessionError("");
    } catch (e) {
      setSessionError(e.message);
    }
    if (!silent) setSessionLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSession();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadSession]);

  // Outro terminal fechou ou abriu o caixa — reflete aqui sem precisar
  // reiniciar o app (ver useCashSessionRealtime). O próprio fechamento
  // também dispara isso: enquanto a janela do fechamento estiver aberta,
  // espera — senão o resumo sumia e, ao fechá-lo depois, o PDV "esquecia"
  // o caixa novo já aberto ("já existe um caixa aberto" até reiniciar).
  const closeModalOpenRef = useRef(false);
  useEffect(() => {
    closeModalOpenRef.current = closeModalOpen;
  }, [closeModalOpen]);
  const handleRemoteChange = useCallback(() => {
    if (closeModalOpenRef.current) return;
    loadSession({ silent: true });
  }, [loadSession]);
  useCashSessionRealtime(handleRemoteChange);

  const handleOpenSession = async () => {
    const amount = Number(openingAmountInput);
    if (!Number.isFinite(amount) || amount < 0) {
      setSessionError("Informe um valor inicial válido.");
      return;
    }
    setOpeningSession(true);
    setSessionError("");
    try {
      setSession(await openCashSession(amount));
      setOpeningAmountInput("");
    } catch (e) {
      // Já tem caixa aberto (ex: outro terminal abriu agora): entra nele em
      // vez de travar na tela de abrir caixa
      const existing = await getOpenCashSession().catch(() => null);
      if (existing) {
        setSession(existing);
        setOpeningAmountInput("");
      } else {
        setSessionError(e.message);
      }
    }
    setOpeningSession(false);
  };

  const handleCloseSession = async () => {
    const amount = Number(declaredAmountInput);
    if (!Number.isFinite(amount) || amount < 0) {
      setCloseError("Informe um valor válido.");
      return;
    }
    setClosing(true);
    setCloseError("");
    try {
      const result = await closeCashSession(session.id, amount);
      setCloseResult({ ...result, sessionId: session.id });
    } catch (e) {
      setCloseError(e.message);
    }
    setClosing(false);
  };

  const resetCloseModal = () => {
    const closedSessionId = closeResult?.sessionId ?? null;
    setCloseModalOpen(false);
    setDeclaredAmountInput("");
    setCloseError("");
    setCloseResult(null);
    if (closedSessionId) {
      // Só "esquece" o caixa que foi fechado — nunca um caixa aberto depois
      setSession((prev) => (prev?.id === closedSessionId ? null : prev));
      // e confere no banco (outro terminal pode ter aberto um novo)
      loadSession({ silent: true });
    }
  };

  return {
    session, sessionLoading, openingAmountInput, setOpeningAmountInput,
    openingSession, sessionError, closeModalOpen, setCloseModalOpen,
    declaredAmountInput, setDeclaredAmountInput, closing, closeError, closeResult,
    handleOpenSession, handleCloseSession, resetCloseModal,
  };
}
