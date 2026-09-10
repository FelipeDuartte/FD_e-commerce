import { useEffect, useState } from "react";
import { getCreditInstallmentFeeRate } from "../services/storeConfigService";
import { DEFAULT_INSTALLMENT_FEE_RATE } from "../utils/creditFee";

// Busca uma vez ao montar o Pdv (mesmo estilo de useCashSession/useProdutos)
// — se falhar ou vier nulo, fica na tabela fixa (DEFAULT_INSTALLMENT_FEE_RATE)
// em vez de travar a tela de Venda por causa disso.
export function useStoreCreditFeeRate() {
  const [rate, setRate] = useState(DEFAULT_INSTALLMENT_FEE_RATE);

  useEffect(() => {
    let cancelled = false;
    getCreditInstallmentFeeRate()
      .then((fetched) => {
        if (!cancelled && fetched) setRate(fetched);
      })
      .catch((e) => {
        console.error("[useStoreCreditFeeRate]", e);
      });
    return () => { cancelled = true; };
  }, []);

  return rate;
}
