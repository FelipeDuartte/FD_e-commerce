const LAST_ADDRESS_PREFIX = "dudu-last-address";

function getAddressKey(userId) {
  return userId ? `${LAST_ADDRESS_PREFIX}:${userId}` : null;
}

export function loadLastDeliveryAddress(userId) {
  const key = getAddressKey(userId);
  if (!key) return null;

  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : null;
  } catch (error) {
    console.warn("Endereco salvo invalido. Limpando ultima localizacao.", error);
    localStorage.removeItem(key);
    return null;
  }
}

export function saveLastDeliveryAddress(userId, address) {
  const key = getAddressKey(userId);
  if (!key || address?.isRetirada) return;

  try {
    localStorage.setItem(key, JSON.stringify(address));
  } catch (error) {
    console.warn("Nao foi possivel salvar a ultima localizacao.", error);
  }
}
