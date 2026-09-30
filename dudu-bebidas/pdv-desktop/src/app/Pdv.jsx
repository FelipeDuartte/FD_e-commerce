import { useEffect, useState, lazy, Suspense } from "react";
import { useCashSession } from "../features/caixa/hooks/useCashSession";
import { useProductCatalog } from "../features/venda/hooks/useProductCatalog";
import { useCart } from "../features/venda/hooks/useCart";
import { useSale } from "../features/venda/hooks/useSale";
import { useStoreCreditFeeRate } from "../features/venda/hooks/useStoreCreditFeeRate";
import { useFiadoCustomers } from "../features/clientes/hooks/useFiadoCustomers";
import { useProdutos } from "../features/produtos/hooks/useProdutos";
import { useAdminCategories } from "../features/produtos/hooks/useAdminCategories";
import { useContasAPagar } from "../features/contas-a-pagar/hooks/useContasAPagar";
import { useAppUpdater } from "../shared/hooks/useAppUpdater";
import OpenSessionForm from "../features/caixa/components/OpenSessionForm";
import ProductCatalog from "../features/venda/components/ProductCatalog";
import CartPanel from "../features/venda/components/CartPanel";
import HistorySalesList from "../features/historico/components/HistorySalesList";
import ClientesView from "../features/clientes/components/ClientesView";
import CloseSessionModal from "../features/caixa/components/CloseSessionModal";
import CancelSaleModal from "../shared/components/CancelSaleModal";
import RemoveSaleItemModal from "../shared/components/RemoveSaleItemModal";

// Abas menos usadas no dia a dia (Venda/Histórico/Clientes ficam eager,
// são as de uso constante) — carregadas sob demanda só quando o operador
// realmente clica na aba, em vez de todo boot do PDV baixar tudo de uma vez.
const ProdutosView = lazy(() => import("../features/produtos/components/ProdutosView"));
const EstoqueView = lazy(() => import("../features/estoque/components/EstoqueView"));
const RelatoriosView = lazy(() => import("../features/relatorios/components/RelatoriosView"));
const ContasAPagarView = lazy(() => import("../features/contas-a-pagar/components/ContasAPagarView"));

function TabLoadingFallback() {
  return (
    <div className="pdv-loading-screen">
      <div className="adm-spinner" />
      <p>Carregando...</p>
    </div>
  );
}

// Config da nav rail — usada só aqui, não vale a pena um arquivo próprio.
const PDV_VIEWS = [
  { key: "venda", label: "🛒 Venda" },
  { key: "historico", label: "📋 Histórico" },
  { key: "clientes", label: "👥 Clientes" },
  { key: "produtos", label: "🏷️ Produtos" },
  { key: "estoque", label: "📦 Estoque" },
  { key: "relatorios", label: "📑 Relatórios" },
  { key: "contas-pagar", label: "💰 Contas a Pagar" },
];

// Atalhos de teclado pras abas mais usadas no dia a dia. preventDefault é
// necessário pelo menos pro F5 — sem isso, o WebView do Tauri recarrega o
// app inteiro (mesmo comportamento de um navegador comum).
const VIEW_SHORTCUTS = {
  F4: "venda",
  F5: "historico",
  F6: "clientes",
  F7: "contas-pagar",
};
const SHORTCUT_BY_VIEW = Object.fromEntries(
  Object.entries(VIEW_SHORTCUTS).map(([key, view]) => [view, key]),
);

export default function Pdv({ theme, onToggleTheme }) {
  const [pdvView, setPdvView] = useState("venda");

  const cashSession = useCashSession();
  const fiado = useFiadoCustomers(cashSession.session?.id);
  const catalog = useProductCatalog();
  const cart = useCart();
  const installmentFeeRate = useStoreCreditFeeRate();
  const produtos = useProdutos(() => catalog.reload());
  // Vender um fardo mexe no estoque da BASE (outro produto) — sem isso,
  // a aba Produtos ficava com número desatualizado até o operador trocar
  // de aba e voltar, já que ela tem sua própria lista carregada uma vez,
  // independente do catálogo de Venda. Também usado pelo pedido fiado com
  // produtos criado direto na aba Clientes (mesmo efeito colateral no estoque).
  const reloadProducts = () => { catalog.reload(); produtos.fetchProducts(); };
  const sale = useSale(
    cashSession.session?.id,
    {
      cart: cart.cart, cartTotal: cart.cartTotal, discountAmount: cart.discountAmount,
      clearCart: cart.clearCart, resetDiscount: () => cart.setDiscountInput(""),
      reloadProducts,
    },
    { onFiadoSale: fiado.reload, installmentFeeRate },
  );
  const { categories: dbCategories } = useAdminCategories();
  const updater = useAppUpdater();

  // Verifica uma vez ao abrir o app, com ou sem caixa aberto — só avisa,
  // nunca instala sozinho (ver useAppUpdater).
  useEffect(() => {
    updater.checkForUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Só ativa os atalhos com o caixa aberto (é quando as abas de fato existem
  // na tela) — antes disso o app mostra a tela de abrir caixa, sem nav rail.
  useEffect(() => {
    if (!cashSession.session) return;
    const handleKeyDown = (e) => {
      const view = VIEW_SHORTCUTS[e.key];
      if (!view) return;
      e.preventDefault();
      setPdvView(view);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cashSession.session]);
  const contasAPagar = useContasAPagar();

  const themeToggleBtn = (
    <button
      className="adm-theme-toggle"
      onClick={onToggleTheme}
      title={theme === "light" ? "Mudar para tema escuro" : "Mudar para tema claro"}
    >
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );

  if (cashSession.sessionLoading) {
    return (
      <div className="pdv-app-shell">
        <div className="pdv-topbar">
          <span className="pdv-topbar-brand">
            <img src="/fdigital-logo.png" alt="FDigital" className="pdv-topbar-logo" />
            FDigital — Dudu Bebidas
          </span>
          {themeToggleBtn}
        </div>
        <div className="pdv-loading-screen">
          <div className="adm-spinner" />
          <p>Verificando caixa...</p>
        </div>
      </div>
    );
  }

  if (!cashSession.session) {
    return (
      <div className="pdv-app-shell">
        <div className="pdv-topbar">
          <span className="pdv-topbar-brand">
            <img src="/fdigital-logo.png" alt="FDigital" className="pdv-topbar-logo" />
            FDigital — Dudu Bebidas
          </span>
          {themeToggleBtn}
        </div>
        <OpenSessionForm
          sessionError={cashSession.sessionError}
          openingAmountInput={cashSession.openingAmountInput}
          setOpeningAmountInput={cashSession.setOpeningAmountInput}
          openingSession={cashSession.openingSession}
          onOpen={cashSession.handleOpenSession}
        />
      </div>
    );
  }

  return (
    <div className="pdv-app-shell">
      <div className="pdv-topbar">
        <span className="pdv-topbar-brand">
          <img src="/fdigital-logo.png" alt="FDigital" className="pdv-topbar-logo" />
          FDigital — Dudu Bebidas
        </span>
        <div className="pdv-topbar-status">
          <span>
            Caixa aberto às {new Date(cashSession.session.opened_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            {" · "}{sale.sessionSales.length} venda(s) nesta sessão
          </span>
          <button className="pdv-topbar-close-btn" onClick={() => cashSession.setCloseModalOpen(true)}>
            🔒 Fechar caixa
          </button>
          {themeToggleBtn}
        </div>
      </div>

      {(sale.saleSuccess || sale.saleError || updater.updateAvailable || updater.error) && (
        <div className="pdv-banner-row">
          {sale.saleSuccess && <div className="adm-store-success">✅ {sale.saleSuccess}</div>}
          {sale.saleError && <div className="adm-modal-error">⚠️ {sale.saleError}</div>}
          {updater.updateAvailable && (
            <div className="pdv-update-banner">
              <span>🔄 Nova versão disponível (v{updater.updateVersion})</span>
              <button
                type="button"
                className="pdv-update-btn"
                onClick={updater.installUpdate}
                disabled={updater.installing}
              >
                {updater.installing ? "Instalando..." : "Atualizar agora"}
              </button>
            </div>
          )}
          {updater.error && <div className="adm-modal-error">⚠️ {updater.error}</div>}
        </div>
      )}

      <div className="pdv-body">
        <nav className="pdv-navrail">
          {PDV_VIEWS.map(({ key, label }) => (
            <button
              key={key}
              className={`pdv-navrail-btn ${pdvView === key ? "active" : ""}`}
              onClick={() => setPdvView(key)}
            >
              {label}
              {SHORTCUT_BY_VIEW[key] && (
                <span className="pdv-navrail-shortcut">{SHORTCUT_BY_VIEW[key]}</span>
              )}
            </button>
          ))}
        </nav>

        <main className="pdv-content">
          {pdvView === "venda" && (
            <div className="pdv-layout">
              <ProductCatalog
                search={catalog.search}
                setSearch={catalog.setSearch}
                productsError={catalog.productsError}
                productsLoading={catalog.productsLoading}
                filteredProducts={catalog.filteredProducts}
                addToCart={cart.addToCart}
              />
              <CartPanel
                cart={cart.cart}
                updateQuantity={cart.updateQuantity}
                removeFromCart={cart.removeFromCart}
                paymentMethod={sale.paymentMethod}
                setPaymentMethod={sale.setPaymentMethod}
                installments={sale.installments}
                setInstallments={sale.setInstallments}
                installmentFeeRate={installmentFeeRate}
                discountMode={cart.discountMode}
                setDiscountMode={cart.setDiscountMode}
                discountInput={cart.discountInput}
                setDiscountInput={cart.setDiscountInput}
                subtotal={cart.subtotal}
                discountAmount={cart.discountAmount}
                cartTotal={cart.cartTotal}
                saleTotal={sale.saleTotal}
                submitting={sale.submitting}
                onFinalize={sale.handleFinalizeSale}
                receivedAmountInput={sale.receivedAmountInput}
                setReceivedAmountInput={sale.setReceivedAmountInput}
                changeAmount={sale.changeAmount}
                insufficientCash={sale.insufficientCash}
                splitMode={sale.splitMode}
                toggleSplitMode={sale.toggleSplitMode}
                splitPayments={sale.splitPayments}
                updateSplitLine={sale.updateSplitLine}
                addSplitLine={sale.addSplitLine}
                removeSplitLine={sale.removeSplitLine}
                splitRemaining={sale.splitRemaining}
                splitValid={sale.splitValid}
                fiadoCustomer={sale.fiadoCustomer}
                setFiadoCustomer={sale.setFiadoCustomer}
                missingFiadoCustomer={sale.missingFiadoCustomer}
                fiadoCustomers={fiado.customers}
                fiadoCustomersLoading={fiado.loading}
                createFiadoCustomer={fiado.createCustomer}
              />
            </div>
          )}

          {pdvView === "historico" && (
            <HistorySalesList
              currentSessionId={cashSession.session.id}
              cancelError={sale.cancelError}
              sessionSales={sale.sessionSales}
              cancellingId={sale.cancellingId}
              onCancelSale={sale.handleCancelSale}
            />
          )}

          {pdvView === "clientes" && (
            <ClientesView
              customers={fiado.customers}
              customersLoading={fiado.loading}
              customersError={fiado.error}
              payDebt={fiado.payDebt}
              createCustomer={fiado.createCustomer}
              updateCustomer={fiado.updateCustomer}
              setCustomerActive={fiado.setCustomerActive}
              deleteCustomer={fiado.deleteCustomer}
              currentSessionId={cashSession.session.id}
              cancellingId={sale.cancellingId}
              onCancelSale={sale.handleCancelSale}
              onRemoveItem={sale.handleRemoveItem}
              reloadProducts={reloadProducts}
            />
          )}

          <Suspense fallback={<TabLoadingFallback />}>
            {pdvView === "produtos" && (
              <ProdutosView produtos={produtos} categories={dbCategories} />
            )}

            {pdvView === "estoque" && <EstoqueView />}

            {pdvView === "relatorios" && <RelatoriosView />}

            {pdvView === "contas-pagar" && <ContasAPagarView contasAPagar={contasAPagar} />}
          </Suspense>
        </main>
      </div>

      {cashSession.closeModalOpen && (
        <CloseSessionModal
          closing={cashSession.closing}
          closeError={cashSession.closeError}
          closeResult={cashSession.closeResult}
          declaredAmountInput={cashSession.declaredAmountInput}
          setDeclaredAmountInput={cashSession.setDeclaredAmountInput}
          onConfirm={cashSession.handleCloseSession}
          onDismiss={cashSession.resetCloseModal}
        />
      )}

      {sale.confirmingSale && (
        <CancelSaleModal
          sale={sale.confirmingSale}
          cancelling={sale.cancellingId === sale.confirmingSale.orderId}
          onConfirm={sale.confirmCancelSale}
          onDismiss={sale.dismissCancelSale}
        />
      )}

      {sale.itemToRemove && (
        <RemoveSaleItemModal
          item={sale.itemToRemove.item}
          removing={sale.removingItem}
          removeError={sale.removeItemError}
          onConfirm={sale.confirmRemoveItem}
          onDismiss={sale.dismissRemoveItem}
        />
      )}
    </div>
  );
}
