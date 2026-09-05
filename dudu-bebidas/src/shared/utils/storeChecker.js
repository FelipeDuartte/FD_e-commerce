import { isHoliday } from "./holidays";
import { STORE_STATUS } from "./storeStatus";

// ── Versão dinâmica (usa configuração do banco) ───────────────────────────────
/**
 * Cria um "checker" de horário baseado nas configurações salvas no banco.
 * Retorna funções equivalentes às estáticas, mas usando dados do Supabase.
 *
 * @param {object}  storeConfig   — linha da tabela store_config
 * @param {Array}   hoursData     — linhas da tabela store_hours
 * @returns {{ getStatus, isOpen, isPurchaseAllowed }}
 *
 * Exemplo de uso:
 *   const cfg = await getStoreConfig();
 *   const hrs = await listStoreHours();
 *   const checker = createStoreChecker(cfg, hrs);
 *   const status  = checker.getStatus();
 */
export function createStoreChecker(storeConfig, hoursData) {
  const byDay = Object.fromEntries(
    (hoursData ?? []).map((h) => [h.day_of_week, h])
  );

  function getStatus(date = new Date()) {
    const dayOfWeek = date.getDay();

    // 1. Verificar feriados (se configurado)
    if (storeConfig?.close_on_holidays && isHoliday(date)) {
      return STORE_STATUS.holiday;
    }

    // 2. Verificar configuração do dia da semana
    const dayConfig = byDay[dayOfWeek];

    if (dayConfig && !dayConfig.is_open) {
      if (dayOfWeek === 0) return STORE_STATUS.sunday;
      if (dayOfWeek === 1) return STORE_STATUS.monday;
      return {
        open: false,
        reason: "closed_day",
        message: "A loja está fechada hoje.",
        shortMessage: "Fechado",
      };
    }

    // 3. Verificar horário de funcionamento
    if (dayConfig) {
      const openStr  = (dayConfig.open_time  ?? "09:00").slice(0, 5);
      const closeStr = (dayConfig.close_time ?? "19:00").slice(0, 5);
      const [openH,  openM]  = openStr.split(":").map(Number);
      const [closeH, closeM] = closeStr.split(":").map(Number);

      const currentMin = date.getHours() * 60 + date.getMinutes();
      const openMin    = openH  * 60 + openM;
      const closeMin   = closeH * 60 + closeM;

      if (currentMin < openMin) {
        return {
          open: false,
          reason: "before_hours",
          message: `Ainda não abrimos. Abrimos às ${openStr}.`,
          shortMessage: `Abre às ${openStr}`,
        };
      }

      if (currentMin >= closeMin) {
        return {
          open: false,
          reason: "after_hours",
          message: `Fora do horário. Retornamos amanhã às ${openStr}.`,
          shortMessage: `Fechado (fecha às ${closeStr})`,
        };
      }
    }

    return STORE_STATUS.open;
  }

  return {
    getStatus,
    isOpen:              (date) => getStatus(date).open,
    isPurchaseAllowed:   (date) => getStatus(date).open,
  };
}
