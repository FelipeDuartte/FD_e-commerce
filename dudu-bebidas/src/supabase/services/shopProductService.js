import { supabase } from "../Supabaseclient";
import { createServiceError } from "../../utils/serviceError";

export const ShopServiceError = createServiceError("ShopServiceError");

export function normalizeProduct(product) {
  return {
    id: product.id,
    nome: product.name,
    categoria: product.category,
    preco: Number(product.price),
    precoAntigo: product.old_price ? Number(product.old_price) : null,
    desconto: product.discount,
    imagem: product.image,
    estoque: product.stock,
    promocao: product.promotion,
    fornecedor: product.supplier,
    ean: product.ean,
    isActive: product.is_active,
  };
}

export async function listActiveProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) {
    throw new ShopServiceError("Não foi possível carregar os produtos.", error);
  }

  return (data ?? []).map(normalizeProduct);
}
