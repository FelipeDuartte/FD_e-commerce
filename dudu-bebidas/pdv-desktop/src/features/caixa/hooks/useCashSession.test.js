// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Banco de mentira: qual caixa está aberto agora
const db = vi.hoisted(() => ({ open: null, nextId: 1, realtime: null }));

vi.mock("../services/cashSessionService", () => ({
  getOpenCashSession: vi.fn(async () => db.open),
  openCashSession: vi.fn(async (amount) => {
    if (db.open) throw new Error("Já existe um caixa aberto nesta loja.");
    db.open = { id: `caixa-${db.nextId++}`, opening_amount: amount, status: "open" };
    return db.open;
  }),
  closeCashSession: vi.fn(async () => {
    db.open = null;
    return { success: true, expected: 100, declared: 100, difference: 0, breakdown: [] };
  }),
}));
// Tempo real: o teste dispara o aviso quando quiser
vi.mock("./useCashSessionRealtime", () => ({
  useCashSessionRealtime: (onChange) => { db.realtime = onChange; },
}));

const { useCashSession } = await import("./useCashSession");

async function setup() {
  const hook = renderHook(() => useCashSession());
  await waitFor(() => expect(hook.result.current.sessionLoading).toBe(false));
  return hook.result;
}

async function openCash(cash, amount = "100") {
  act(() => cash.current.setOpeningAmountInput(amount));
  await act(() => cash.current.handleOpenSession());
}

async function closeCash(cash) {
  act(() => cash.current.setCloseModalOpen(true));
  act(() => cash.current.setDeclaredAmountInput("100"));
  await act(() => cash.current.handleCloseSession());
}

beforeEach(() => {
  db.open = null;
  db.nextId = 1;
});

describe("useCashSession", () => {
  it("bug relatado: fechar e abrir de novo em seguida NÃO dá 'já existe caixa aberto'", async () => {
    const cash = await setup();
    await openCash(cash);
    await closeCash(cash);
    // o próprio fechamento chega pelo tempo real
    await act(async () => db.realtime());

    // O operador age pelo que vê na tela (Pdv.jsx): sem caixa na tela =
    // formulário de abrir caixa (a janela do resumo some junto); com caixa
    // na tela = a janela do resumo continua lá pra ele fechar.
    const visible = () => (cash.current.sessionLoading ? "carregando" : cash.current.session ? "pdv" : "abrir-caixa");

    if (visible() === "abrir-caixa") await openCash(cash, "50"); // código antigo caía aqui
    if (cash.current.closeModalOpen) act(() => cash.current.resetCloseModal());
    await act(async () => {});
    if (visible() === "abrir-caixa") await openCash(cash, "50");

    // No fim, a tela mostra exatamente o caixa que está aberto no banco
    expect(cash.current.sessionError).toBe("");
    expect(cash.current.session?.id).toBe(db.open?.id);
    expect(cash.current.session).not.toBeNull();
  });

  it("o resumo do fechamento continua na tela até o operador fechar", async () => {
    const cash = await setup();
    await openCash(cash);
    await closeCash(cash);
    await act(async () => db.realtime());
    expect(cash.current.sessionLoading).toBe(false);
    expect(cash.current.session).not.toBeNull();
    expect(cash.current.closeResult).not.toBeNull();
  });

  it("fechar o resumo só esquece o caixa que foi fechado", async () => {
    const cash = await setup();
    await openCash(cash);
    await closeCash(cash);
    act(() => cash.current.resetCloseModal());
    await waitFor(() => expect(cash.current.session).toBeNull());
    expect(cash.current.closeModalOpen).toBe(false);
  });

  it("já existe caixa aberto (ex: outro terminal abriu agora): entra nele em vez de travar", async () => {
    const cash = await setup();
    db.open = { id: "caixa-do-outro-terminal", opening_amount: 80, status: "open" };
    await openCash(cash);
    expect(cash.current.session.id).toBe("caixa-do-outro-terminal");
    expect(cash.current.sessionError).toBe("");
  });

  it("outro terminal fechou o caixa: some daqui sem tela de carregamento", async () => {
    const cash = await setup();
    await openCash(cash);
    db.open = null; // fechado em outro terminal
    await act(async () => db.realtime());
    expect(cash.current.session).toBeNull();
    expect(cash.current.sessionLoading).toBe(false);
  });

  it("valor inicial inválido não abre", async () => {
    const cash = await setup();
    await openCash(cash, "-5");
    expect(cash.current.session).toBeNull();
    expect(cash.current.sessionError).toContain("valor inicial");
  });
});
