BEGIN;

-- Contas a Pagar — controle das obrigações financeiras da loja (fornecedores,
-- consórcios, honorários etc), independente de orders/stock_movements.
CREATE TABLE public.accounts_payable (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid NOT NULL REFERENCES public.stores(id),
  description     text NOT NULL,        -- "Referente a"
  supplier        text,                 -- "Fornecedor"
  document_type   text,                 -- "Tipo" (Boleto, Nota Fiscal, Outro documento…)
  document_number text,                 -- "Número do documento"
  category        text,                 -- "Categoria da despesa" (texto livre)
  amount          numeric(10,2) NOT NULL CHECK (amount > 0),
  due_date        date NOT NULL,
  paid_at         date,                 -- null = ainda não paga
  amount_paid     numeric(10,2),
  notes           text,                 -- outras informações
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- status/dias/mês/semana não são colunas: calculados na UI a partir de
-- due_date/paid_at (mesmo princípio de shouldRemoveOrder/formatLastOrder).
CREATE INDEX idx_accounts_payable_store_due ON public.accounts_payable(store_id, due_date);

ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de cash_sessions/stock_movements: só admin da própria loja.
CREATE POLICY accounts_payable_admin_all ON public.accounts_payable
  FOR ALL TO authenticated
  USING (is_store_admin(store_id))
  WITH CHECK (is_store_admin(store_id));

COMMIT;
