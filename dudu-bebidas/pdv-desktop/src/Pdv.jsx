import { useState } from "react";
import { useCashSession } from "./hooks/useCashSession";
import { usePdvCart } from "./hooks/usePdvCart";
import { useFiadoCustomers } from "./hooks/useFiadoCustomers";
import { PDV_VIEWS } from "./constants";
import OpenSessionForm from "./components/OpenSessionForm";
import ProductCatalog from "./components/ProductCatalog";
import CartPanel from "./components/CartPanel";
import HistorySalesList from "./components/HistorySalesList";
import ClientesView from "./components/ClientesView";
import CloseSessionModal from "./components/CloseSessionModal";
import CancelSaleModal from "./components/CancelSaleModal";

export default function Pdv({ theme, onToggleTheme }) {
  const [pdvView, setPdvView] = useState("venda");

  const cashSession = useCashSession();
  const fiado = useFiadoCustomers(cashSession.session?.id);
  const pdvCart = usePdvCart(cashSession.session?.id, { onFiadoSale: fiado.reload });

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
            {" · "}{pdvCart.sessionSales.length} venda(s) nesta sessão
          </span>
          <button className="pdv-topbar-close-btn" onClick={() => cashSession.setCloseModalOpen(true)}>
            🔒 Fechar caixa
          </button>
          {themeToggleBtn}
        </div>
      </div>

      {(pdvCart.saleSuccess || pdvCart.saleError) && (
        <div className="pdv-banner-row">
          {pdvCart.saleSuccess && <div className="adm-store-success">✅ {pdvCart.saleSuccess}</div>}
          {pdvCart.saleError && <div className="adm-modal-error">⚠️ {pdvCart.saleError}</div>}
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
                search={pdvCart.search}
                setSearch={pdvCart.setSearch}
                productsError={pdvCart.productsError}
                productsLoading={pdvCart.productsLoading}
                filteredProducts={pdvCart.filteredProducts}
                addToCart={pdvCart.addToCart}
              />
              <CartPanel
                cart={pdvCart.cart}
                updateQuantity={pdvCart.updateQuantity}
                removeFromCart={pdvCart.removeFromCart}
                paymentMethod={pdvCart.paymentMethod}
                setPaymentMethod={pdvCart.setPaymentMethod}
                discountMode={pdvCart.discountMode}
                setDiscountMode={pdvCart.setDiscountMode}
                discountInput={pdvCart.discountInput}
                setDiscountInput={pdvCart.setDiscountInput}
                subtotal={pdvCart.subtotal}
                discountAmount={pdvCart.discountAmount}
                cartTotal={pdvCart.cartTotal}
                submitting={pdvCart.submitting}
                onFinalize={pdvCart.handleFinalizeSale}
                receivedAmountInput={pdvCart.receivedAmountInput}
                setReceivedAmountInput={pdvCart.setReceivedAmountInput}
                changeAmount={pdvCart.changeAmount}
                insufficientCash={pdvCart.insufficientCash}
                splitMode={pdvCart.splitMode}
                toggleSplitMode={pdvCart.toggleSplitMode}
                splitPayments={pdvCart.splitPayments}
                updateSplitLine={pdvCart.updateSplitLine}
                addSplitLine={pdvCart.addSplitLine}
                removeSplitLine={pdvCart.removeSplitLine}
                splitRemaining={pdvCart.splitRemaining}
                splitValid={pdvCart.splitValid}
                fiadoCustomer={pdvCart.fiadoCustomer}
                setFiadoCustomer={pdvCart.setFiadoCustomer}
                missingFiadoCustomer={pdvCart.missingFiadoCustomer}
                fiadoCustomers={fiado.customers}
                fiadoCustomersLoading={fiado.loading}
                createFiadoCustomer={fiado.createCustomer}
              />
            </div>
          )}

          {pdvView === "historico" && (
            <HistorySalesList
              cancelError={pdvCart.cancelError}
              sessionSales={pdvCart.sessionSales}
              cancellingId={pdvCart.cancellingId}
              onCancelSale={pdvCart.handleCancelSale}
            />
          )}

          {pdvView === "clientes" && (
            <ClientesView
              customers={fiado.customers}
              customersLoading={fiado.loading}
              customersError={fiado.error}
              payDebt={fiado.payDebt}
              createCustomer={fiado.createCustomer}
            />
          )}
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

      {pdvCart.confirmingSale && (
        <CancelSaleModal
          sale={pdvCart.confirmingSale}
          cancelling={pdvCart.cancellingId === pdvCart.confirmingSale.orderId}
          onConfirm={pdvCart.confirmCancelSale}
          onDismiss={pdvCart.dismissCancelSale}
        />
      )}
    </div>
  );
}
