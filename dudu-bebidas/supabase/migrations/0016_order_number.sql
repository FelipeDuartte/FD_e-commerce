BEGIN;

-- ─────────────────────────────────────────────────────────────
-- Número de pedido sequencial por loja — pra atendente/cliente
-- referenciarem um pedido sem precisar de um UUID ("pedido #42" em vez de
-- "3f8a1c...c92e"). Sequencial POR LOJA (cada loja começa do 1, não é um
-- contador global compartilhado entre lojas — evita vazar volume total de
-- pedidos de outras lojas e mantém os números "limpos" pra cada uma).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE public.store_order_counters (
  store_id    uuid PRIMARY KEY REFERENCES public.stores(id),
  next_number integer NOT NULL DEFAULT 1
);

ALTER TABLE public.store_order_counters ENABLE ROW LEVEL SECURITY;
-- Sem nenhuma policy de propósito — só a trigger abaixo (SECURITY DEFINER)
-- mexe aqui, nunca o client direto (nem admin nem anônimo).

ALTER TABLE public.orders ADD COLUMN order_number integer;

-- INSERT ... ON CONFLICT ... RETURNING é atômico (lock de linha do
-- upsert) — sem essa atomicidade, duas vendas simultâneas na mesma loja
-- poderiam calcular o mesmo "próximo número" e colidir.
CREATE OR REPLACE FUNCTION public.assign_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_number integer;
BEGIN
  INSERT INTO public.store_order_counters (store_id, next_number)
  VALUES (NEW.store_id, 2)
  ON CONFLICT (store_id) DO UPDATE
    SET next_number = store_order_counters.next_number + 1
  RETURNING next_number - 1 INTO v_number;

  NEW.order_number := v_number;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_order_number
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.assign_order_number();

-- Backfill dos pedidos que já existem, numerando em ordem cronológica
-- dentro de cada loja.
WITH numbered AS (
  SELECT id, store_id, row_number() OVER (PARTITION BY store_id ORDER BY created_at) AS rn
  FROM public.orders
)
UPDATE public.orders o
SET order_number = numbered.rn
FROM numbered
WHERE o.id = numbered.id;

-- Continua o contador de cada loja de onde o backfill parou (lojas sem
-- nenhum pedido ainda simplesmente não entram aqui — a trigger cria a
-- linha delas sozinha, começando do 1, no primeiro pedido real).
INSERT INTO public.store_order_counters (store_id, next_number)
SELECT store_id, COALESCE(MAX(order_number), 0) + 1
FROM public.orders
GROUP BY store_id
ON CONFLICT (store_id) DO UPDATE
  SET next_number = EXCLUDED.next_number;

ALTER TABLE public.orders ALTER COLUMN order_number SET NOT NULL;
ALTER TABLE public.orders ADD CONSTRAINT orders_store_order_number_unique UNIQUE (store_id, order_number);

COMMIT;
