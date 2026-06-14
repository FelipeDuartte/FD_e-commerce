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
    const { userId, deliveryFee = 0, paymentMethod, address, cartItems } = await req.json();

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

    // 1. Buscar preços reais no banco — ignora o total enviado pelo front-end
    const productIds = cartItems.map((item) => String(item.id));

    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, price, is_active, stock")
      .in("id", productIds);

    if (productsError || !products) {
      console.error("Erro ao buscar produtos:", productsError);
      return new Response(JSON.stringify({ error: "Erro ao validar produtos." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Valida se todos os produtos existem e estão ativos
    for (const item of cartItems) {
      const product = products.find((p) => p.id === String(item.id));
      if (!product) {
        return new Response(JSON.stringify({ error: `Produto não encontrado: ${item.id}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!product.is_active) {
        return new Response(JSON.stringify({ error: `Produto indisponível: ${item.name ?? item.id}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Calcula o total real usando os preços do banco
    const calculatedProductsTotal = cartItems.reduce((sum, item) => {
      const product = products.find((p) => p.id === String(item.id));
      return sum + (product?.price ?? 0) * item.quantity;
    }, 0);
    const normalizedDeliveryFee = Math.max(0, Number(deliveryFee) || 0);
    const calculatedTotal = calculatedProductsTotal + normalizedDeliveryFee;

    // 2. Inserir o pedido com o total calculado no servidor
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id:        userId ?? null,
        total:          calculatedTotal,
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

    // 3. Inserir os itens
    const orderItems = cartItems.map((item) => ({
      order_id:   order.id,
      product_id: String(item.id),
      name:       item.name,
      price:      products.find((p) => p.id === String(item.id))?.price ?? item.price,
      quantity:   item.quantity,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(orderItems);

    if (itemsError) {
      console.error("Erro ao salvar itens:", itemsError);
      return new Response(JSON.stringify({ error: "Erro ao salvar itens do pedido." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Baixa no estoque via RPC
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
