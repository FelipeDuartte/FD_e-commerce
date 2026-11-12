import { getBrand } from "../../shared/brand/brand";
import { getCurrentStore } from "../../shared/supabase/Supabaseclient";
import { useDeliveryZones } from "../cart/hooks/useDeliveryZones";
import { useStoreHoursData } from "../../shared/context/useStoreStatus";
import { useOnlinePaymentConfig } from "../checkout/hooks/useOnlinePaymentConfig";

// "a", "a e b", "a, b e c"
export function joinList(items) {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

// Como cada forma de pagamento aparece no texto dos termos
const ONLINE_PAYMENT_TEXT = "PIX ou cartão online";
const PAYMENT_TEXT = [
  ["pix_entrega", "PIX na entrega"],
  ["credit_card", "cartão na entrega"],
  ["debit_card", "cartão na entrega"],
  ["cash", "dinheiro na entrega"],
];

// Dados que os termos e a política usam: marca (nome, cidade, contato…) +
// cadastro da loja no banco (bairros, formas de pagamento, +18).
export function useLegalInfo() {
  const brand = getBrand();
  const { zones } = useDeliveryZones();
  const enabled = useStoreHoursData()?.config?.payment_methods_enabled;
  const online = useOnlinePaymentConfig();

  const neighborhoods = zones.filter((z) => !z.is_retirada).map((z) => z.nome);
  const payments = enabled
    ? [
        ...(online.infinitepay && enabled.infinitepay !== false ? [ONLINE_PAYMENT_TEXT] : []),
        ...new Set(PAYMENT_TEXT.filter(([key]) => enabled[key]).map(([, text]) => text)),
      ]
    : [];

  return {
    name: brand.name,
    logoText: brand.logoText,
    ...brand.legal,
    ageGate: Boolean(getCurrentStore()?.age_gate),
    hasPickup: zones.some((z) => z.is_retirada),
    neighborhoods,
    payments,
  };
}
