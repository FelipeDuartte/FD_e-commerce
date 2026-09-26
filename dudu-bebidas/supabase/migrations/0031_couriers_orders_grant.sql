BEGIN;

-- 0030_couriers.sql adicionou courier_id/courier_name/courier_phone em
-- orders, mas o GRANT UPDATE do projeto pra authenticated é por coluna
-- (não a tabela toda) — sem isso, o admin recebia 403 ao tentar atribuir
-- entregador, mesmo já podendo atualizar outras colunas como status.
-- Já foi rodado manualmente em produção (testado e confirmado); registrado
-- aqui só pra manter o histórico de migrations completo.
GRANT UPDATE (courier_id, courier_name, courier_phone) ON public.orders TO authenticated;

COMMIT;
