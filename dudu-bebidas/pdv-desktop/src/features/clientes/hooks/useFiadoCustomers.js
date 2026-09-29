import { useCallback, useEffect, useState } from "react";
import {
  listPdvCustomerBalances,
  createPdvCustomer,
  updatePdvCustomer,
  setPdvCustomerActive,
  deletePdvCustomer,
  registerFiadoPayment,
  createPdvCustomerCharge,
} from "../services/fiadoService";
import { useFiadoBalancesRealtime } from "./useFiadoRealtime";

// Compartilhado entre o seletor de cliente na venda (CartPanel) e o
// diretório de clientes (ClientesView) — um único carregamento pros dois.
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

  // Recarrega quando fiado é mexido em qualquer terminal — venda,
  // pagamento recebido ou lançamento manual, não só ações deste terminal.
  useFiadoBalancesRealtime(load);

  const createCustomer = async ({ name, phone, email, address }) => {
    const customer = await createPdvCustomer({ name, phone, email, address });
    load();
    return customer;
  };

  const updateCustomer = async (customerId, fields) => {
    await updatePdvCustomer(customerId, fields);
    load();
  };

  const setCustomerActive = async (customerId, isActive) => {
    await setPdvCustomerActive(customerId, isActive);
    load();
  };

  const deleteCustomer = async (customerId) => {
    await deletePdvCustomer(customerId);
    load();
  };

  // Pagar quita da conta mais velha pra mais nova (FIFO) — muda tanto o
  // saldo do cliente quanto quais pedidos continuam na fila em aberto.
  const payDebt = async ({ customerId, amount, paymentMethod }) => {
    await registerFiadoPayment({ customerId, amount, paymentMethod, cashSessionId: sessionId });
    load();
  };

  // Lançamento livre de dívida (sem carrinho) — ver NewChargeModal.
  const addCharge = async ({ customerId, amount, description }) => {
    await createPdvCustomerCharge({ customerId, amount, description, cashSessionId: sessionId });
    load();
  };

  return {
    customers, loading, error, reload: load,
    createCustomer, updateCustomer, setCustomerActive, deleteCustomer, payDebt, addCharge,
  };
}
