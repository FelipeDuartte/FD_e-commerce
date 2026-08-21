export const DAYS = [
  { key: 0, label: "Domingo" },
  { key: 1, label: "Segunda-feira" },
  { key: 2, label: "Terça-feira" },
  { key: 3, label: "Quarta-feira" },
  { key: 4, label: "Quinta-feira" },
  { key: 5, label: "Sexta-feira" },
  { key: 6, label: "Sábado" },
];

export const EMPTY_ZONE = { nome: "", frete: "", is_retirada: false };

export const DEFAULT_HOURS = DAYS.map((d) => ({
  day_of_week: d.key,
  is_open:     d.key !== 0 && d.key !== 1,
  open_time:   "09:00",
  close_time:  d.key === 0 || d.key === 6 ? "19:00" : "17:30",
}));

export const EMPTY_PAYMENT_CONFIG = {
  pix_key: "",
  pix_key_type: "cpf",
  pix_merchant_name: "",
  pix_merchant_city: "",
  mercadopago_public_key: "",
  mercadopago_environment: "test",
  mercadopago_access_token: "",
  mercadopago_access_token_set: false,
  mercadopago_webhook_secret: "",
  mercadopago_webhook_secret_set: false,
};

export const STORE_TABS = [
  { key: "categorias", label: "🏷️ Categorias" },
  { key: "bairros",    label: "🗺️ Taxa por Bairro" },
  { key: "horarios",   label: "🕐 Horários" },
  { key: "equipe",     label: "👥 Equipe" },
  { key: "pagamentos", label: "💳 Pagamentos" },
];
