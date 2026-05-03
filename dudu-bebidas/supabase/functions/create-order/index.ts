import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, total, paymentMethod, address, cartItems } = await req.json();

    // Usa service role — bypassa RLS completamente
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );

    // Validações básicas
    if (!cartItems || cartItems.length === 0)
      return new Response(JSON.stringify({ error: "Carrinho vazio." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    if (!paymentMethod)
      return new Response(JSON.stringify({ error: "Forma de pagamento não selecionada." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // 1. Inserir o pedido
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id:        userId ?? null,
        total,
        payment_method: paymentMethod,
        address,
        status:         "pending",
      })
      .select("id")
      .single();

    if (orderError) {
      console.error("Erro ao criar pedido:", orderError);
      return new Response(JSON.stringify({ error: "Não foi possível criar o pedido." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Inserir os itens
    const orderItems = cartItems.map((item) => ({
      order_id:   order.id,
      product_id: String(item.id),
      name:       item.name,
      price:      item.price,
      quantity:   item.quantity,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(orderItems);

    if (itemsError) {
      console.error("Erro ao salvar itens:", itemsError);
      return new Response(JSON.stringify({ error: "Erro ao salvar itens do pedido." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Baixa no estoque via RPC
    const rpcItems = cartItems.map((item) => ({
      product_id: String(item.id),
      quantity:   item.quantity,
    }));

    const { data: rpcResult, error: rpcError } = await supabase.rpc("process_order", {
      p_order_id: order.id,
      p_items:    rpcItems,
    });

    if (rpcError) {
      console.error("Erro na RPC:", rpcError);
      return new Response(JSON.stringify({ error: "Erro ao atualizar estoque." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!rpcResult?.success) {
      return new Response(JSON.stringify({ error: rpcResult?.error ?? "Erro ao processar estoque." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ orderId: order.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Erro inesperado:", err);
    return new Response(JSON.stringify({ error: "Erro interno do servidor." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});