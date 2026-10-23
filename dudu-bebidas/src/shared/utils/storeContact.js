import { getCurrentStore } from "../supabase/Supabaseclient";

// Contatos públicos da loja atual (tabela stores). Cada função devolve null
// quando a loja não cadastrou o dado — quem chama esconde o botão/bloco.

const digitsOnly = (value) => String(value ?? "").replace(/\D/g, "");

// wa.me exige só dígitos com DDI.
export function whatsappLink(phone = getCurrentStore()?.whatsapp) {
  const digits = digitsOnly(phone);
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`;
}

// "553183077990" → "+55 (31) 8307-7990"
export function formatWhatsapp(phone = getCurrentStore()?.whatsapp) {
  const digits = digitsOnly(phone);
  if (!digits) return null;
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  const ddd = local.slice(0, 2);
  const number = local.slice(2);
  const split = number.length - 4;
  return `+55 (${ddd}) ${number.slice(0, split)}-${number.slice(split)}`;
}

export function instagramLink(user = getCurrentStore()?.instagram) {
  const handle = String(user ?? "").trim().replace(/^@/, "");
  return handle ? `https://www.instagram.com/${handle}/` : null;
}

export function pickupAddress() {
  const store = getCurrentStore();
  if (!store?.pickup_address) return null;
  return { street: store.pickup_address, detail: store.pickup_address_detail || "" };
}
