import { supabase, getCurrentStoreId } from "../../../supabase/Supabaseclient";
import { calcDiscount } from "../adminUtils";
import { AdminServiceError } from "./AdminServiceError";
import { getCurrentUserId } from "./adminTeamService";

const optionalValue = (value) => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
};

export function buildProductPayload(form) {
  const oldPrice = form.old_price !== "" ? Number(form.old_price) : null;
  const price = Number(form.price);
  const stock = Number(form.stock);

  return {
    id: String(form.id).trim(),
    store_id: getCurrentStoreId(), // multi-loja: obrigatório desde a migração
    name: String(form.name).trim(),
    category: form.category,
    price,
    old_price: form.promotion ? oldPrice : null,
    discount: form.promotion ? calcDiscount(oldPrice, price) : null,
    image: optionalValue(form.image),
    stock,
    is_active: form.is_active,
    promotion: form.promotion,
    supplier: optionalValue(form.supplier),
    ean: optionalValue(form.ean),
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

  if (
    product.promotion &&
    product.old_price !== null &&
    product.old_price <= product.price
  ) {
    return "O preço antigo deve ser maior que o preço atual.";
  }

  return null;
}

export async function listAdminProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("name");

  if (error) {
    throw new AdminServiceError("Não foi possível carregar os produtos.", error);
  }

  return data ?? [];
}

export async function saveAdminProduct(product, isNew, previousStock = null) {
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
        console.error("[adminProductService] Erro ao registrar movimentação de estoque:", movementError);
      }
    }
  }
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
