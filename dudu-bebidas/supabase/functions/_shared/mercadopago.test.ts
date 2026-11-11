import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyMercadoPagoSignature } from "./mercadopago.ts";

// Assinatura calculada aqui com o crypto do Node, de forma independente,
// seguindo a documentação do MP: HMAC-SHA256 de
// "id:{data.id minúsculo};request-id:{x-request-id};ts:{ts};"
function sign(dataId: string, requestId: string, ts: string, secret: string) {
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  return createHmac("sha256", secret).update(manifest).digest("hex");
}

const SECRET = "chave-secreta-da-loja";
const TS = "1704908010";
const valid = () => ({
  xSignature: `ts=${TS},v1=${sign("123456", "req-abc", TS, SECRET)}`,
  xRequestId: "req-abc",
  dataId: "123456",
  secret: SECRET,
});

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("verifyMercadoPagoSignature", () => {
  it("aceita a assinatura correta", async () => {
    expect(await verifyMercadoPagoSignature(valid())).toBe(true);
  });

  it("aceita espaços no header (formato 'ts=..., v1=...')", async () => {
    const v = valid();
    expect(await verifyMercadoPagoSignature({ ...v, xSignature: v.xSignature.replace(",", ", ") })).toBe(true);
  });

  it("id com letras é comparado em minúsculo", async () => {
    const xSignature = `ts=${TS},v1=${sign("ABC123", "req-abc", TS, SECRET)}`;
    expect(await verifyMercadoPagoSignature({ ...valid(), xSignature, dataId: "ABC123" })).toBe(true);
  });

  it.each([
    ["chave secreta diferente", { secret: "outra-chave" }],
    ["outro pagamento", { dataId: "999999" }],
    ["outro request-id", { xRequestId: "req-xyz" }],
    ["timestamp trocado", { xSignature: `ts=1704908011,v1=${sign("123456", "req-abc", TS, SECRET)}` }],
    ["hash adulterado", { xSignature: `ts=${TS},v1=${"0".repeat(64)}` }],
    ["sem header x-signature", { xSignature: null }],
    ["sem header x-request-id", { xRequestId: null }],
    ["formato inesperado", { xSignature: "assinatura-qualquer" }],
  ])("recusa: %s", async (_, overrides) => {
    expect(await verifyMercadoPagoSignature({ ...valid(), ...overrides })).toBe(false);
  });
});
