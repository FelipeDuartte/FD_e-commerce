import { useState } from "react";
import { useCashSession } from "../features/caixa/hooks/useCashSession";
import { useProductCatalog } from "../features/venda/hooks/useProductCatalog";
import { useCart } from "../features/venda/hooks/useCart";
import { useSale } from "../features/venda/hooks/useSale";
import { useFiadoCustomers } from "../features/clientes/hooks/useFiadoCustomers";
import { useProdutos } from "../features/produtos/hooks/useProdutos";
import { useAdminCategories } from "../features/produtos/hooks/useAdminCategories";
import { useContasAPagar } from "../features/contas-a-pagar/hooks/useContasAPagar";
import OpenSessionForm from "../features/caixa/components/OpenSessionForm";
import ProductCatalog from "../features/venda/components/ProductCatalog";
import CartPanel from "../features/venda/components/CartPanel";
import HistorySalesList from "../features/historico/components/HistorySalesList";
import ClientesView from "../features/clientes/components/ClientesView";
import ProdutosView from "../features/produtos/components/ProdutosView";
import EstoqueView from "../features/estoque/components/EstoqueView";
import RelatoriosView from "../features/relatorios/components/RelatoriosView";
import ContasAPagarView from "../features/contas-a-pagar/components/ContasAPagarView";
import CloseSessionModal from "../features/caixa/components/CloseSessionModal";
import CancelSaleModal from "../shared/components/CancelSaleModal";

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

export default function Pdv({ theme, onToggleTheme }) {
  const [pdvView, setPdvView] = useState("venda");

  const cashSession = useCashSession();
  const fiado = useFiadoCustomers(cashSession.session?.id);
  const catalog = useProductCatalog();
  const cart = useCart();
  const sale = useSale(
    cashSession.session?.id,
    {
      cart: cart.cart, cartTotal: cart.cartTotal, discountAmount: cart.discountAmount,
      clearCart: cart.clearCart, resetDiscount: () => cart.setDiscountInput(""),
      reloadProducts: catalog.reload,
    },
    { onFiadoSale: fiado.reload },
  );
  const produtos = useProdutos();
  const { categories: dbCategories } = useAdminCategories();
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
          <span className="pdv-topbar-brand">🧾 PDV — Dudu Bebidas</span>
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
          <span className="pdv-topbar-brand">🧾 PDV — Dudu Bebidas</span>
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
        <span className="pdv-topbar-brand">🧾 PDV — Dudu Bebidas</span>
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

      {(sale.saleSuccess || sale.saleError) && (
        <div className="pdv-banner-row">
          {sale.saleSuccess && <div className="adm-store-success">✅ {sale.saleSuccess}</div>}
          {sale.saleError && <div className="adm-modal-error">⚠️ {sale.saleError}</div>}
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
                discountMode={cart.discountMode}
                setDiscountMode={cart.setDiscountMode}
                discountInput={cart.discountInput}
                setDiscountInput={cart.setDiscountInput}
                subtotal={cart.subtotal}
                discountAmount={cart.discountAmount}
                cartTotal={cart.cartTotal}
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
              addCharge={fiado.addCharge}
              createCustomer={fiado.createCustomer}
              updateCustomer={fiado.updateCustomer}
              setCustomerActive={fiado.setCustomerActive}
              deleteCustomer={fiado.deleteCustomer}
              currentSessionId={cashSession.session.id}
              cancellingId={sale.cancellingId}
              onCancelSale={sale.handleCancelSale}
            />
          )}

          {pdvView === "produtos" && (
            <ProdutosView produtos={produtos} categories={dbCategories} />
          )}

          {pdvView === "estoque" && <EstoqueView />}

          {pdvView === "relatorios" && <RelatoriosView />}

          {pdvView === "contas-pagar" && <ContasAPagarView contasAPagar={contasAPagar} />}
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
    </div>
  );
}
