BEGIN;

-- ─────────────────────────────────────────────────────────────
-- Pagamentos — Fase 2: cartão de crédito online via Mercado Pago
-- (Card Payment Brick + API de pagamentos). Diferente da Fase 1
-- (Pix/entrega), aqui o estoque só é baixado quando o pagamento é
-- de fato aprovado — nunca no momento da criação do pedido.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.store_payment_configs
  ADD COLUMN mercadopago_webhook_secret text; -- "Chave secreta" do webhook, painel do MP

-- Lookup do webhook por pedido é feito via external_reference (= orders.id),
-- não por este índice — mas ele acelera a listagem/auditoria de pagamentos
-- por payment_reference (id do pagamento no MP) quando precisar depurar.
CREATE INDEX idx_orders_payment_reference ON public.orders(payment_reference)
  WHERE payment_reference IS NOT NULL;

-- ── Config pública do Mercado Pago (chamável por convidado) ────────────────
-- O Card Payment Brick roda no navegador do cliente e precisa da Public Key
-- pra inicializar — não é segredo (é feita pra ser pública), mas o Access
-- Token e a chave do webhook NUNCA são devolvidos aqui. "enabled" existe
-- pra o Checkout só oferecer a opção de cartão online se a loja já
-- configurou as duas credenciais de teste/produção.
CREATE OR REPLACE FUNCTION public.get_mercadopago_public_config(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_config record;
begin
  select mercadopago_public_key, mercadopago_access_token
    into v_config
    from public.store_payment_configs
   where store_id = p_store_id;

  return jsonb_build_object(
    'enabled', v_config.mercadopago_public_key is not null and v_config.mercadopago_access_token is not null,
    'public_key', v_config.mercadopago_public_key
  );
end;
$function$;

-- ── Confirma pagamento aprovado e baixa o estoque (uma única vez) ──────────
-- Chamada tanto pelo caminho síncrono (Payments API responde "approved" na
-- hora) quanto pelo webhook (quando a aprovação vem depois, ou como
-- reconfirmação). O UPDATE ... WHERE payment_status <> 'pago' é o que
-- garante atomicidade: se duas chamadas concorrentes chegarem quase juntas
-- (ex: o Mercado Pago reenvia o webhook, prática documentada deles), só a
-- primeira "ganha a corrida" e baixa estoque — a segunda vê 0 linhas
-- afetadas e não faz nada. Sem isso, um reenvio de webhook baixaria o
-- estoque em dobro pro mesmo pedido.
CREATE OR REPLACE FUNCTION public.confirm_mercadopago_payment(
  p_order_id uuid, p_store_id uuid, p_payment_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_claimed uuid;
  v_order_status text;
  item record;
begin
  update public.orders
     set payment_status = 'pago',
         payment_reference = p_payment_id
   where id = p_order_id
     and store_id = p_store_id
     and payment_status <> 'pago'
  returning id, status into v_claimed, v_order_status;

  if v_claimed is null then
    -- Já estava pago (segunda notificação do mesmo evento, ou corrida
    -- perdida contra outra chamada) — idempotente, não é erro.
    return jsonb_build_object('success', true, 'stock_decremented', false);
  end if;

  -- Caso raro: cliente cancelou o pedido enquanto o pagamento ainda estava
  -- "in_process" no MP, e a aprovação chegou depois (webhook atrasado). O
  -- dinheiro já foi capturado pelo Mercado Pago independente do que
  -- fizermos aqui — mas baixar estoque de um pedido cancelado/rejeitado
  -- reservaria produto pra uma entrega que não vai acontecer. Marca como
  -- pago (é a verdade financeira) só sem mexer no estoque; fica pra
  -- conferência manual do admin (caso raro o suficiente pra não justificar
  -- um fluxo de estorno automático agora).
  if v_order_status in ('cancelled', 'rejected') then
    return jsonb_build_object('success', true, 'stock_decremented', false, 'order_already_terminal', true);
  end if;

  for item in
    select oi.product_id, oi.name, oi.quantity
      from public.order_items oi
     where oi.order_id = p_order_id
  loop
    -- greatest(0, ...) de propósito: o cartão já foi cobrado pelo Mercado
    -- Pago nesse ponto — não dá pra "recusar" o pedido por falta de
    -- estoque aqui (diferente de process_order, chamado ANTES de cobrar
    -- qualquer coisa). Um estoque zerado por corrida rara fica pra
    -- conferência manual do admin, não trava a confirmação do pedido pago.
    update public.products
       set stock = greatest(0, stock - item.quantity),
           is_active = case when stock - item.quantity <= 0 then false else is_active end
     where store_id = p_store_id
       and id = item.product_id;

    insert into public.stock_movements (store_id, product_id, product_name, quantity, reason, order_id)
    values (p_store_id, item.product_id, item.name, -item.quantity, 'venda', p_order_id);
  end loop;

  return jsonb_build_object('success', true, 'stock_decremented', true);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;

-- ── Marca pagamento recusado/cancelado/expirado (nunca baixa estoque) ──────
-- Nunca sobrescreve um pedido que já está 'pago' (proteção contra o webhook
-- entregar um evento antigo fora de ordem depois de uma aprovação).
CREATE OR REPLACE FUNCTION public.mark_mercadopago_payment_failed(
  p_order_id uuid, p_store_id uuid, p_status text, p_payment_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if p_status not in ('pagamento_recusado', 'pagamento_cancelado', 'pagamento_expirado') then
    return jsonb_build_object('success', false, 'error', 'Status inválido.');
  end if;

  update public.orders
     set payment_status = p_status,
         payment_reference = coalesce(payment_reference, p_payment_id)
   where id = p_order_id
     and store_id = p_store_id
     and payment_status <> 'pago';

  return jsonb_build_object('success', true);
end;
$function$;

-- ── cancel_order: não devolve estoque que nunca foi baixado ────────────────
-- Fase 1 (pix/entrega) sempre baixa estoque na criação do pedido, então
-- cancelar sempre precisou devolver. Cartão online (Mercado Pago) mudou
-- isso: o estoque só desce quando o pagamento é aprovado
-- (confirm_mercadopago_payment). Sem essa checagem, cancelar um pedido MP
-- ainda "processando_pagamento"/"pagamento_recusado" chamaria restore_stock
-- e inflaria o estoque de algo que nunca tinha sido descontado.
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid, p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_result  jsonb;
  v_order   record;
  v_skip_restore boolean;
begin
  select store_id, status, payment_provider, payment_status into v_order
    from public.orders
   where id = p_order_id;

  if v_order.store_id is null then
    return jsonb_build_object('success', false, 'error', 'Pedido não encontrado.');
  end if;

  if v_order.store_id <> p_store_id then
    return jsonb_build_object('success', false, 'error', 'Pedido não pertence a esta loja.');
  end if;

  if v_order.status <> 'pending' then
    return jsonb_build_object(
      'success', false,
      'error', 'Esse pedido já está em preparo e não pode mais ser cancelado.'
    );
  end if;

  -- coalesce(...,'') é necessário: payment_provider é NULL pra pedidos que
  -- não são Mercado Pago, e "NULL = 'mercadopago'" em SQL dá NULL (não
  -- false) — "NULL and true" também dá NULL, e "if not NULL" em PL/pgSQL
  -- NÃO entra no bloco (mesmo comportamento de false). Sem o coalesce, essa
  -- checagem silenciosamente pulava a devolução de estoque pra QUALQUER
  -- pedido sem payment_provider — ou seja, todo pedido de pix/entrega, que
  -- é o caso mais comum do sistema. Bug real, pego em teste ao vivo.
  v_skip_restore := coalesce(v_order.payment_provider, '') = 'mercadopago' and v_order.payment_status <> 'pago';

  if not v_skip_restore then
    select public.restore_stock(p_order_id, p_store_id) into v_result;

    if (v_result->>'success')::boolean is false then
      return jsonb_build_object('success', false, 'error', v_result->>'error');
    end if;
  end if;

  update public.orders
     set status = 'cancelled'
   where id = p_order_id;

  return jsonb_build_object('success', true);
exception when others then
  return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$function$;

COMMIT;
