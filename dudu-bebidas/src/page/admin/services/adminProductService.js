import { supabase } from "../../../supabase/Supabaseclient";
import { calcDiscount } from "../adminUtils";
import { AdminServiceError } from "./AdminServiceError";

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

export async function saveAdminProduct(product, isNew) {
  const query = isNew
    ? supabase.from("products").insert(product)
    : supabase.from("products").update(product).eq("id", product.id);

  const { error } = await query;

  if (error) {
    throw new AdminServiceError("Não foi possível salvar o produto.", error);
  }
}

export async function toggleAdminProductActive(product) {
  const nextActive = !product.is_active;
  const { error } = await supabase
    .from("products")
    .update({ is_active: nextActive })
    .eq("id", product.id);

  if (error) {
    throw new AdminServiceError("Não foi possível alterar o status.", error);
  }

  return { ...product, is_active: nextActive };
}
