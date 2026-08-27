import { useCallback, useEffect, useState } from "react";
import {
  getOpenCashSession,
  openCashSession,
  closeCashSession,
} from "../services/pdvService";

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

  const loadSession = useCallback(async () => {
    setSessionLoading(true);
    try {
      setSession(await getOpenCashSession());
      setSessionError("");
    } catch (e) {
      setSessionError(e.message);
    }
    setSessionLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSession();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadSession]);

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
      setSessionError(e.message);
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
      setCloseResult(result);
    } catch (e) {
      setCloseError(e.message);
    }
    setClosing(false);
  };

  const resetCloseModal = () => {
    const wasClosed = closeResult !== null;
    setCloseModalOpen(false);
    setDeclaredAmountInput("");
    setCloseError("");
    setCloseResult(null);
    if (wasClosed) {
      setSession(null);
    }
  };

  return {
    session, sessionLoading, openingAmountInput, setOpeningAmountInput,
    openingSession, sessionError, closeModalOpen, setCloseModalOpen,
    declaredAmountInput, setDeclaredAmountInput, closing, closeError, closeResult,
    handleOpenSession, handleCloseSession, resetCloseModal,
  };
}
