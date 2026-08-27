import { useCallback, useEffect, useState } from "react";
import { listPdvCustomerBalances, createPdvCustomer, registerFiadoPayment } from "../services/fiadoService";

// Compartilhado entre o seletor de cliente na venda (CartPanel) e a aba
// de gestão do fiado (FiadoView) — uma única lista/carregamento pros dois.
export function useFiadoCustomers(sessionId) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCustomers(await listPdvCustomerBalances());
      setError("");
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const createCustomer = async ({ name, phone }) => {
    const customer = await createPdvCustomer({ name, phone });
    load();
    return customer;
  };

  const payDebt = async ({ customerId, amount, paymentMethod }) => {
    await registerFiadoPayment({ customerId, amount, paymentMethod, cashSessionId: sessionId });
    load();
  };

  return { customers, loading, error, reload: load, createCustomer, payDebt };
}
