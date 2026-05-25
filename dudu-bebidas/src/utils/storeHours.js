// Utils para horário de funcionamento
export function isMonday() {
  const today = new Date();
  return today.getDay() === 1; // 0=Dom,1=Seg,...
}

export function isStoreOpen() {
  // Regra atual: fechado às segundas
  return !isMonday();
}

export default { isMonday, isStoreOpen };
