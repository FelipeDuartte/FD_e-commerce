// ─────────────────────────────────────────────────────────────
// Gera o payload "Pix Copia e Cola" (BR Code / EMV QR Code, spec do
// BACEN) a partir da chave Pix da loja + valor do pedido — sem
// nenhum gateway/PSP envolvido, é só o texto padronizado que
// qualquer app de banco sabe ler.
// ─────────────────────────────────────────────────────────────

function tlv(id: string, value: string): string {
  const length = value.length.toString().padStart(2, "0");
  return `${id}${length}${value}`;
}

// Remove acentos e qualquer caractere fora do padrão simples exigido pelo
// campo (letras, números, espaço) — nome/cidade não podem ter acento.
// Mesmo padrão de src/utils/normalizeSlug.js (̀-ͯ = acentos).
function sanitizeAscii(str: string, maxLen: number): string {
  const noAccents = str.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const asciiOnly = noAccents.replace(/[^a-zA-Z0-9 ]/g, "");
  const cleaned = asciiOnly.trim().toUpperCase().slice(0, maxLen);
  return cleaned || "NA";
}

// CRC16/CCITT-FALSE — exigido pelo campo final do BR Code (poli 0x1021,
// início 0xFFFF, sem reflexão, sem XOR de saída).
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// Chave Pix do tipo telefone PRECISA estar no formato internacional
// completo (+5531999998888) — sem isso o banco não encontra a chave e
// recusa o pagamento. Aceita qualquer formato comum que o admin digite
// ((31) 99999-8888, 31999998888, +5531999998888...) e normaliza.
// Mesma lógica de normalizePhoneBR (_shared/whatsapp.ts), adaptada pro
// formato com "+" exigido pelo Pix (o WhatsApp usa sem "+").
export function normalizePixPhoneKey(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return raw;

  if (digits.length === 13 && digits.startsWith("55")) return `+${digits}`;
  if (digits.length === 12 && digits.startsWith("55")) return `+${digits}`;
  if (digits.length === 11) return `+55${digits}`;
  if (digits.length === 10) return `+55${digits}`;

  // Não deu pra normalizar com confiança — devolve como veio, mais seguro
  // que inventar um formato errado.
  return raw;
}

export interface PixBrCodeParams {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount: number;
  txid: string;
}

export function buildPixBrCode({ pixKey, merchantName, merchantCity, amount, txid }: PixBrCodeParams): string {
  const merchantAccountInfo = tlv("00", "br.gov.bcb.pix") + tlv("01", pixKey);
  // Campo 05 (referência) precisa ser alfanumérico, sem traços; "***"
  // quando não há referência específica — aqui sempre temos o id do pedido.
  const referenceLabel = (txid || "***").replace(/[^a-zA-Z0-9]/g, "").slice(0, 25) || "***";

  const payload =
    tlv("00", "01") + // Payload Format Indicator
    tlv("01", "11") + // Point of Initiation Method: 11 = estático (sem location dinâmica de PSP)
    tlv("26", merchantAccountInfo) + // Merchant Account Info (GUI + chave Pix)
    tlv("52", "0000") + // Merchant Category Code (genérico)
    tlv("53", "986") + // Moeda: BRL
    tlv("54", amount.toFixed(2)) + // Valor exato do pedido
    tlv("58", "BR") + // País
    tlv("59", sanitizeAscii(merchantName, 25)) + // Nome do recebedor
    tlv("60", sanitizeAscii(merchantCity, 15)) + // Cidade do recebedor
    tlv("62", tlv("05", referenceLabel)) + // Additional Data (referência/txid)
    "6304"; // Início do campo CRC (ID + tamanho fixo 04)

  return payload + crc16(payload);
}
