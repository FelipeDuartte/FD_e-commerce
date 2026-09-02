export const PAGE_SIZE = 20;

export const CATEGORIES = ["cerveja", "vinho", "destilado", "refrigerante", "energetico", "outros"];

export const EMPTY_PRODUCT = {
  id: "",
  name: "",
  category: "cerveja",
  price: "",
  old_price: "",
  image: "",
  stock: "",
  is_active: true,
  show_on_site: true,
  promotion: false,
  supplier: "",
  ean: "",
};

// Próximo ID sequencial (0001, 0002...) a partir do maior ID puramente
// numérico já cadastrado. IDs antigos que não sejam numéricos (nunca deviam
// existir depois da migration de reorganização, mas por segurança) são
// ignorados no cálculo do máximo, não quebram a geração.
export function generateProductId(products = []) {
  const maxSeq = products.reduce((max, p) => {
    const n = /^\d+$/.test(p.id) ? Number(p.id) : NaN;
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return String(maxSeq + 1).padStart(4, "0");
}

export const calcDiscount = (oldPrice, newPrice) =>
  oldPrice > 0 ? Math.round((1 - newPrice / oldPrice) * 100) : null;
