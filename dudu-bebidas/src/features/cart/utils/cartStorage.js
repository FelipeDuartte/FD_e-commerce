const CART_STORAGE_KEY = "dudu-cart";

export function loadStoredCart() {
  try {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Carrinho local inválido. Limpando dados salvos.", error);
    localStorage.removeItem(CART_STORAGE_KEY);
    return [];
  }
}

export function saveStoredCart(items) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn("Não foi possível salvar o carrinho local.", error);
  }
}

export function clearStoredCart() {
  localStorage.removeItem(CART_STORAGE_KEY);
}
