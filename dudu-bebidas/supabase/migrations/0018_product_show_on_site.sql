BEGIN;

-- Separa "produto ativo" (vendável em algum canal) de "aparece no site".
-- Default true: todo produto existente continua aparecendo no site
-- exatamente como hoje — só quem desmarcar no PDV passa a ficar
-- exclusivo do balcão.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS show_on_site boolean NOT NULL DEFAULT true;

COMMIT;
