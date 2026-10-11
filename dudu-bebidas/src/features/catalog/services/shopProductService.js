import { supabase } from "../../../shared/supabase/Supabaseclient";
import { createServiceError } from "../../../shared/utils/serviceError";

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
    isActive: product.is_active,
  };
}

// Só o que a vitrine mostra. Nunca "*": a tabela tem custo (cost_price) e
// fornecedor, que não podem ir pro navegador do cliente.
const SITE_PRODUCT_COLUMNS =
  "id, name, category, price, old_price, discount, image, stock, promotion, is_active";

export async function listActiveProducts() {
  const { data, error } = await supabase
    .from("products")
    .select(SITE_PRODUCT_COLUMNS)
    .eq("is_active", true)
    .eq("show_on_site", true)
    .order("name");

  if (error) {
    throw new ShopServiceError("Não foi possível carregar os produtos.", error);
  }

  return (data ?? []).map(normalizeProduct);
}
