BEGIN;

-- ─────────────────────────────────────────────────────────────
-- Antes de ir pra produção: enquanto a loja estiver com credenciais
-- de TESTE (TEST-...) configuradas, o Checkout não deve nem oferecer
-- "Cartão de crédito (online)" pro cliente — um pagamento de verdade
-- nunca vai funcionar com chave de sandbox (só os cartões de teste do
-- próprio Mercado Pago funcionam nesse modo). Antes, "enabled" só
-- checava se as duas chaves existiam, sem olhar o ambiente.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_mercadopago_public_config(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_config record;
begin
  select mercadopago_public_key, mercadopago_access_token, mercadopago_environment
    into v_config
    from public.store_payment_configs
   where store_id = p_store_id;

  return jsonb_build_object(
    'enabled',
      v_config.mercadopago_public_key is not null
      and v_config.mercadopago_access_token is not null
      and v_config.mercadopago_environment = 'production',
    'public_key', v_config.mercadopago_public_key
  );
end;
$function$;

COMMIT;
