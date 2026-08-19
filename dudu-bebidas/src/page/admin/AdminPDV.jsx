import { useState } from "react";
import "./AdminPDV.css";
import { useCashSession } from "./AdminPDV/hooks/useCashSession";
import { usePdvCart } from "./AdminPDV/hooks/usePdvCart";
import { PDV_VIEWS } from "./AdminPDV/constants";
import OpenSessionForm from "./AdminPDV/components/OpenSessionForm";
import ProductCatalog from "./AdminPDV/components/ProductCatalog";
import CartPanel from "./AdminPDV/components/CartPanel";
import HistorySalesList from "./AdminPDV/components/HistorySalesList";
import CloseSessionModal from "./AdminPDV/components/CloseSessionModal";

export default function AdminPDV() {
  const [pdvView, setPdvView] = useState("venda");

  const cashSession = useCashSession();
  const pdvCart = usePdvCart(cashSession.session?.id);

  // ── Render ─────────────────────────────────────────
  if (cashSession.sessionLoading) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        <p>Verificando caixa...</p>
      </div>
    );
  }

  if (!cashSession.session) {
    return (
      <OpenSessionForm
        sessionError={cashSession.sessionError}
        openingAmountInput={cashSession.openingAmountInput}
        setOpeningAmountInput={cashSession.setOpeningAmountInput}
        openingSession={cashSession.openingSession}
        onOpen={cashSession.handleOpenSession}
      />
    );
  }

  return (
    <>
      <div className="adm-title-row">
        <div>
          <h1 className="adm-title">PDV — Venda de Balcão</h1>
          <p className="adm-subtitle">
            Caixa aberto às {new Date(cashSession.session.opened_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            {" · "}{pdvCart.sessionSales.length} venda(s) nesta sessão
          </p>
        </div>
        <button className="adm-btn-back" onClick={() => cashSession.setCloseModalOpen(true)}>
          🔒 Fechar caixa
        </button>
      </div>

      {pdvCart.saleSuccess && <div className="adm-store-success">✅ {pdvCart.saleSuccess}</div>}
      {pdvCart.saleError && <div className="adm-modal-error">⚠️ {pdvCart.saleError}</div>}

      <div className="pdv-shell">
        <div className="pdv-sidebar">
          {PDV_VIEWS.map(({ key, label }) => (
            <button
              key={key}
              className={`pdv-sidebar-btn ${pdvView === key ? "active" : ""}`}
              onClick={() => setPdvView(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="pdv-main">
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
        </div>
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
    </>
  );
}
