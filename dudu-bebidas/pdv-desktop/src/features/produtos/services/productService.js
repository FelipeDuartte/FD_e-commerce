import { supabase, getCurrentStoreId } from "../../../shared/supabase/Supabaseclient";
import { calcDiscount } from "../utils/productConstants";
import { normalizeProductName } from "../utils/productNameMatch";
import { AdminServiceError } from "../../../shared/services/AdminServiceError";

async function getCurrentUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

const optionalValue = (value) => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
};

export function buildProductPayload(form) {
  const oldPrice = form.old_price !== "" ? Number(form.old_price) : null;
  const price = Number(form.price);
  const stock = Number(form.stock);
  const packOfProductId = optionalValue(form.pack_of_product_id);

  return {
    id: String(form.id).trim(),
    store_id: getCurrentStoreId(), // multi-loja: obrigatório
    name: normalizeProductName(form.name),
    category: form.category,
    price,
    old_price: form.promotion ? oldPrice : null,
    discount: form.promotion ? calcDiscount(oldPrice, price) : null,
    image: optionalValue(form.image),
    stock,
    is_active: form.is_active,
    show_on_site: form.show_on_site,
    promotion: form.promotion,
    // Promoção só do balcão — independente da do site (ver migration 0047).
    pdv_promo_price: form.pdv_promotion && form.pdv_promo_price !== "" ? Number(form.pdv_promo_price) : null,
    supplier: optionalValue(form.supplier),
    ean: optionalValue(form.ean),
    // Fardo/caixa de outro produto — quando preenchido, o "stock" acima é
    // só o último valor calculado (ver sync_pack_stock); quem manda de
    // verdade é o estoque do produto base.
    pack_of_product_id: packOfProductId,
    pack_units: packOfProductId ? Number(form.pack_units) : null,
  };
}

export function validateProductPayload(product) {
  if (!product.id || !product.name) {
    return "Preencha ID e nome do produto.";
  }

  if (!Number.isFinite(product.price) || product.price < 0) {
    return "Informe um preço válido.";
  }

  if (!Number.isFinite(product.stock) || product.stock < 0) {
    return "Informe um estoque válido.";
  }

  if (product.promotion && product.old_price !== null && product.old_price <= product.price) {
    return "O preço promocional do site precisa ser menor que o preço de venda.";
  }

  if (product.pdv_promo_price !== null && !(Number.isFinite(product.pdv_promo_price) && product.pdv_promo_price > 0)) {
    return "Informe um preço promocional do PDV válido.";
  }

  if (product.pack_of_product_id) {
    if (product.pack_of_product_id === product.id) {
      return "Um produto não pode ser fardo de si mesmo.";
    }
    if (!Number.isInteger(product.pack_units) || product.pack_units < 2) {
      return "Informe quantas unidades esse fardo tem (mínimo 2).";
    }
  }

  return null;
}

// Custo e fornecedor ficam em product_costs (só admin da loja enxerga —
// products é pública por causa da vitrine). Aqui eles voltam pro produto
// como cost_price/supplier, então o resto do PDV não precisa saber disso.
function withPrivateFields({ product_costs: costs, ...product }) {
  const row = Array.isArray(costs) ? costs[0] : costs;
  return { ...product, cost_price: row?.cost_price ?? null, supplier: row?.supplier ?? null };
}

export async function listAdminProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*, product_costs(cost_price, supplier)")
    .order("name");

  if (error) {
    throw new AdminServiceError("Não foi possível carregar os produtos.", error);
  }
  return (data ?? []).map(withPrivateFields);
}

export async function saveAdminProduct(payload, isNew, previousStock = null) {
  const { supplier, ...product } = payload;
  const query = isNew
    ? supabase.from("products").insert(product)
    : supabase
        .from("products")
        .update(product)
        .eq("id", product.id)
        .eq("store_id", product.store_id);

  const { error } = await query;

  if (error) {
    throw new AdminServiceError("Não foi possível salvar o produto.", error);
  }

  // Fornecedor: só a coluna supplier — o custo (cost_price) não é tocado.
  if (!isNew || supplier != null) {
    const { error: supplierError } = await supabase
      .from("product_costs")
      .upsert(
        { store_id: product.store_id, product_id: product.id, supplier, updated_at: new Date().toISOString() },
        { onConflict: "store_id,product_id" },
      );
    if (supplierError) {
      throw new AdminServiceError("Produto salvo, mas não foi possível salvar o fornecedor.", supplierError);
    }
  }

  // Ajuste manual de estoque (edição direta na aba Produtos) vira uma
  // movimentação, igual venda/cancelamento já viram via process_order/
  // restore_stock. Produto novo não tem "ajuste" — o estoque inicial não é
  // uma movimentação, é só o ponto de partida.
  if (!isNew && previousStock !== null) {
    const delta = Number(product.stock) - Number(previousStock);
    if (delta !== 0) {
      const userId = await getCurrentUserId();
      const { error: movementError } = await supabase.from("stock_movements").insert({
        store_id: product.store_id,
        product_id: product.id,
        product_name: product.name,
        quantity: delta,
        reason: "ajuste_manual",
        created_by: userId,
      });
      if (movementError) {
        // Não interrompe o fluxo — o produto já foi salvo; perder o log de
        // auditoria é ruim, mas não deveria travar quem só quer salvar.
        console.error("[productService] Erro ao registrar movimentação de estoque:", movementError);
      }
    }
  }

  // Recalcula o estoque exibido nas duas direções: se este produto é um
  // fardo, atualiza ele a partir da base recém-vinculada; se é uma base,
  // atualiza qualquer fardo que dependa dela (ex: editou o estoque da base
  // na mão). Sem isso o número só ficaria certo depois da próxima venda.
  const { error: syncError } = await supabase.rpc("sync_pack_stock", {
    p_store_id: product.store_id,
    p_product_id: product.id,
  });
  if (syncError) {
    console.error("[productService] Erro ao sincronizar estoque de fardo:", syncError);
  }
}

// Reabastece estoque + registra o custo de compra num passo só (RPC faz
// tudo atomicamente: soma no stock, atualiza cost_price, loga em
// stock_movements e recalcula fardos dependentes). Retorna o custo
// anterior junto do novo pra tela mostrar a comparação.
export async function registerProductPurchase(product, quantity, totalPaid) {
  const qty = Number(quantity);
  const total = Number(totalPaid);
  const unitCost = total / qty;

  const { data, error } = await supabase.rpc("register_product_purchase", {
    p_store_id: product.store_id,
    p_product_id: product.id,
    p_quantity: qty,
    p_unit_cost: unitCost,
  });

  if (error) {
    throw new AdminServiceError("Não foi possível registrar a compra.", error);
  }
  if (!data?.success) {
    throw new AdminServiceError(data?.error || "Não foi possível registrar a compra.");
  }
  return { previousCost: data.previous_cost, newCost: data.new_cost, unitCost };
}

// Entrada de bonificação (grátis) — não mexe em cost_price (ver migration
// 0037), só soma estoque e guarda o valor estimado (quantidade × preço de
// venda atual) pra mostrar quanto de lucro esse lote grátis representa.
export async function registerProductBonus(product, quantity) {
  const qty = Number(quantity);

  const { data, error } = await supabase.rpc("register_product_bonus", {
    p_store_id: product.store_id,
    p_product_id: product.id,
    p_quantity: qty,
  });

  if (error) {
    throw new AdminServiceError("Não foi possível registrar a bonificação.", error);
  }
  if (!data?.success) {
    throw new AdminServiceError(data?.error || "Não foi possível registrar a bonificação.");
  }
  return { bonusValue: data.bonus_value, salePrice: data.sale_price };
}

export async function toggleAdminProductActive(product) {
  const nextActive = !product.is_active;
  const { error } = await supabase
    .from("products")
    .update({ is_active: nextActive })
    .eq("id", product.id)
    .eq("store_id", product.store_id);

  if (error) {
    throw new AdminServiceError("Não foi possível alterar o status.", error);
  }

  return { ...product, is_active: nextActive };
}

export async function deleteAdminProduct(product) {
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", product.id)
    .eq("store_id", product.store_id);

  if (error) {
    if (error.code === "23503") {
      throw new AdminServiceError(
        "Esse produto tem vendas ou movimentações de estoque registradas — desative em vez de excluir.",
        error,
      );
    }
    throw new AdminServiceError("Não foi possível excluir o produto.", error);
  }
}
