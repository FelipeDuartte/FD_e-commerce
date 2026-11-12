// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("../../../shared/supabase/Supabaseclient", () => ({
  supabase: { functions: { invoke } },
  getCurrentStoreId: () => "store-a",
}));

const { readReturnParams, useInfinitePayPayment } = await import("./useInfinitePayPayment");

let assign;
const setSearch = (search) =>
  vi.stubGlobal("location", { ...window.location, assign, search, pathname: "/confirmacao" });

beforeEach(() => {
  invoke.mockReset();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/confirmacao");
  assign = vi.fn();
  setSearch("");
});
afterEach(() => vi.unstubAllGlobals());

describe("readReturnParams", () => {
  it("lê o que a InfinitePay manda na volta", () => {
    expect(readReturnParams("?order_nsu=o1&transaction_nsu=tx&slug=sl&capture_method=pix")).toEqual({
      orderNsu: "o1", transactionNsu: "tx", slug: "sl",
    });
  });
  it("sem os códigos: null", () => {
    expect(readReturnParams("?order_nsu=o1")).toBeNull();
  });
});

describe("useInfinitePayPayment", () => {
  it("1ª vez aguardando pagamento: cria o link e leva pra InfinitePay", async () => {
    invoke.mockResolvedValue({ data: { url: "https://checkout.infinitepay.com.br/abc" }, error: null });
    renderHook(() => useInfinitePayPayment({ orderId: "o1", active: true }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://checkout.infinitepay.com.br/abc"));
    expect(invoke).toHaveBeenCalledWith("infinitepay-checkout", {
      body: { action: "create", orderId: "o1", storeId: "store-a" },
    });
  });

  it("voltou sem pagar: não redireciona sozinho de novo (fica o botão)", async () => {
    sessionStorage.setItem("infinitepay-redirected-o1", "1");
    renderHook(() => useInfinitePayPayment({ orderId: "o1", active: true }));
    await new Promise((r) => setTimeout(r, 10));
    expect(invoke).not.toHaveBeenCalled();
  });

  it("botão 'Pagar agora' abre o mesmo pagamento", async () => {
    sessionStorage.setItem("infinitepay-redirected-o1", "1");
    invoke.mockResolvedValue({ data: { url: "https://checkout.infinitepay.com.br/abc" }, error: null });
    const { result } = renderHook(() => useInfinitePayPayment({ orderId: "o1", active: true }));
    await act(() => result.current.payNow());
    expect(assign).toHaveBeenCalledWith("https://checkout.infinitepay.com.br/abc");
  });

  it("erro ao abrir o pagamento: mostra a mensagem do servidor", async () => {
    sessionStorage.setItem("infinitepay-redirected-o1", "1");
    invoke.mockResolvedValue({
      data: null,
      error: { context: { json: async () => ({ error: "O prazo para pagar este pedido acabou. Faça o pedido de novo." }) } },
    });
    const { result } = renderHook(() => useInfinitePayPayment({ orderId: "o1", active: true }));
    await act(() => result.current.payNow());
    expect(result.current.error).toContain("prazo");
    expect(assign).not.toHaveBeenCalled();
  });

  it("voltou da InfinitePay: confere o pagamento (sem redirecionar de novo)", async () => {
    setSearch("?order_nsu=o1&transaction_nsu=tx-1&slug=sl-1&capture_method=pix");
    invoke.mockResolvedValue({ data: { paid: true, status: "paid" }, error: null });
    renderHook(() => useInfinitePayPayment({ orderId: "o1", active: true }));
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("infinitepay-checkout", {
        body: { action: "check", orderId: "o1", storeId: "store-a", transactionNsu: "tx-1", slug: "sl-1" },
      })
    );
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
  });

  it("parâmetros de OUTRO pedido na URL: ignora", async () => {
    setSearch("?order_nsu=outro&transaction_nsu=tx&slug=sl");
    sessionStorage.setItem("infinitepay-redirected-o1", "1");
    renderHook(() => useInfinitePayPayment({ orderId: "o1", active: true }));
    await new Promise((r) => setTimeout(r, 10));
    expect(invoke).not.toHaveBeenCalled();
  });

  it("pedido que não é pagamento online: não faz nada", async () => {
    renderHook(() => useInfinitePayPayment({ orderId: "o1", active: false }));
    await new Promise((r) => setTimeout(r, 10));
    expect(invoke).not.toHaveBeenCalled();
  });
});
