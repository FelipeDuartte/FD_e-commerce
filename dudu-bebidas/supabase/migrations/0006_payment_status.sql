BEGIN;

-- ─────────────────────────────────────────────────────────────
-- Pagamentos — Fase 1: PIX (chave da própria loja) + status de
-- pagamento genérico, separado do status de preparo/entrega
-- (orders.status). payment_status nasce com DEFAULT 'pago' de
-- propósito: todo pedido existente (dinheiro, PDV, etc.) não percebe
-- que essa coluna existe — só create-order passa a setar
-- explicitamente 'aguardando_pagamento' pra pix/entrega.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.orders
  ADD COLUMN payment_status text NOT NULL DEFAULT 'pago'
    CHECK (payment_status IN (
      'aguardando_pagamento', 'processando_pagamento', 'pago',
      'pagamento_recusado', 'pagamento_cancelado', 'pagamento_expirado'
    )),
  ADD COLUMN payment_provider text, -- null = sem gateway; 'pix_manual' | futuramente 'mercadopago'
  ADD COLUMN payment_reference text, -- txid do pix hoje; payment_id do MP na Fase 2
  ADD COLUMN customer_claimed_paid_at timestamptz; -- "já paguei" do cliente — NUNCA confirma sozinho

-- ── Configuração de pagamento por loja ──────────────────────────────────────
CREATE TABLE public.store_payment_configs (
  store_id                  uuid PRIMARY KEY REFERENCES public.stores(id),
  pix_key                   text,
  pix_key_type              text CHECK (pix_key_type IN ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
  pix_merchant_name         text, -- aparece no QR, máx 25 caracteres (spec BACEN)
  pix_merchant_city         text, -- máx 15 caracteres, sem acento (spec BACEN)
  mercadopago_public_key    text, -- Fase 2, fica null por enquanto
  mercadopago_access_token  text, -- Fase 2, fica null por enquanto — nunca lido de volta pelo admin
  mercadopago_environment   text NOT NULL DEFAULT 'test' CHECK (mercadopago_environment IN ('test', 'production')),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_payment_configs ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de cash_sessions/stock_movements: só admin da própria loja,
-- nenhum acesso público. Quem gera o QR é a edge function pix-charge, com
-- service role — o navegador do cliente nunca lê essa tabela direto.
CREATE POLICY store_payment_configs_admin_all ON public.store_payment_configs
  FOR ALL TO authenticated
  USING (is_store_admin(store_id))
  WITH CHECK (is_store_admin(store_id));

-- ── Admin confirma manualmente que um PIX caiu ──────────────────────────────
-- Fase 1: não baixa estoque nem muda mais nada no fluxo do pedido, é só
-- registro. Mesmo padrão de outras RPCs administrativas (SECURITY DEFINER,
-- retorno {success, error}).
CREATE OR REPLACE FUNCTION public.mark_order_paid(p_order_id uuid, p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order record;
BEGIN
  IF NOT is_store_admin(p_store_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão.');
  END IF;

  SELECT id, store_id INTO v_order FROM public.orders WHERE id = p_order_id;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não encontrado.');
  END IF;

  IF v_order.store_id <> p_store_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pedido não pertence a esta loja.');
  END IF;

  UPDATE public.orders SET payment_status = 'pago' WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- ── Cliente avisa que pagou (não confirma pagamento sozinho) ───────────────
-- Chamável por convidado (mesmo modelo de get_order_status): só quem já
-- conhece o UUID do pedido consegue chamar. Só grava o timestamp da PRIMEIRA
-- vez (guard "customer_claimed_paid_at IS NULL") — clique repetido não
-- reseta o horário original.
CREATE OR REPLACE FUNCTION public.mark_customer_claimed_paid(p_order_id uuid, p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.orders
     SET customer_claimed_paid_at = now()
   WHERE id = p_order_id
     AND store_id = p_store_id
     AND payment_method = 'pix'
     AND customer_claimed_paid_at IS NULL;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- ── get_order_status agora também devolve payment_status e o timestamp de
-- "já paguei" do cliente, pra Confirm.jsx decidir qual dos 3 estados
-- mostrar (QR / aguardando confirmação / esteira normal).
CREATE OR REPLACE FUNCTION public.get_order_status(p_order_id uuid, p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_order record;
begin
  select status, payment_status, payment_method, customer_claimed_paid_at
    into v_order
    from public.orders
   where id = p_order_id
     and store_id = p_store_id;

  if v_order.status is null then
    return jsonb_build_object('success', false, 'error', 'Pedido não encontrado.');
  end if;

  return jsonb_build_object(
    'success', true,
    'status', v_order.status,
    'payment_status', v_order.payment_status,
    'payment_method', v_order.payment_method,
    'customer_claimed_paid_at', v_order.customer_claimed_paid_at
  );
end;
$function$;

COMMIT;
