import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Admin.css";
import ProductModal from "./ProductModal";
import RejectModal from "./RejectModal";
import AdminReports from "./AdminReports";
import AdminStore from "./AdminStore";
import AdminPDV from "./AdminPDV";
import AdminStock from "./AdminStock";
import { useAdminReports } from "./hooks/useAdminReports";
import { useAdminCategories } from "./hooks/useAdminCategories";
import { useAdminOrders } from "./Admin/hooks/useAdminOrders";
import { useAdminProducts } from "./Admin/hooks/useAdminProducts";
import AdminHeader from "./Admin/components/AdminHeader";
import AdminTabs from "./Admin/components/AdminTabs";
import OrdersTab from "./Admin/components/OrdersTab";
import ProductsTab from "./Admin/components/ProductsTab";

export default function Admin({ isAdmin }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("pedidos");

  const orders = useAdminOrders(isAdmin);
  const products = useAdminProducts(activeTab);

  const { reportData, loading: reportsLoading, error: reportsError, period, setPeriod, refresh: refreshReports } =
    useAdminReports(activeTab === "relatorios");

  const { categories: dbCategories } = useAdminCategories();

  if (isAdmin === null)
    return (
      <div className="adm-root">
        <div className="adm-wrap">
          <div className="adm-loading">
            <div className="adm-spinner" />
            <p>Verificando acesso...</p>
          </div>
        </div>
      </div>
    );

  if (!isAdmin) return null;

  return (
    <div className="adm-root">
      <div className="adm-wrap">
        {orders.rejectModal && (
          <RejectModal
            rejectModal={orders.rejectModal}
            closeRejectModal={orders.closeRejectModal}
            confirmReject={orders.confirmReject}
            rejectError={orders.rejectError}
            rejecting={orders.rejecting}
          />
        )}

        {products.productModal && (
          <ProductModal
            productModal={products.productModal}
            modalForm={products.modalForm}
            modalSaving={products.modalSaving}
            modalError={products.modalError}
            handleModalChange={products.handleModalChange}
            handleModalSave={products.handleModalSave}
            setProductModal={products.setProductModal}
            categories={dbCategories}
            imageStatus={products.productImageSearch.status}
            imageError={products.productImageSearch.error}
            imageProgress={products.productImageSearch.progress}
            onUploadImage={products.productImageSearch.uploadImage}
            onResetImage={products.productImageSearch.resetToManual}
          />
        )}

        <AdminHeader onBack={() => navigate("/")} />

        <AdminTabs
          activeTab={activeTab}
          onChange={setActiveTab}
          ordersCount={orders.orders.length}
          productsCount={products.products.length}
        />

        {activeTab === "pedidos" && (
          <OrdersTab
            orders={orders.orders}
            loading={orders.loading}
            loadingMore={orders.loadingMore}
            hasMore={orders.hasMore}
            totalCount={orders.totalCount}
            ordersError={orders.ordersError}
            updating={orders.updating}
            filterStatus={orders.filterStatus}
            setFilterStatus={orders.setFilterStatus}
            expandedId={orders.expandedId}
            setExpandedId={orders.setExpandedId}
            metrics={orders.metrics}
            counts={orders.counts}
            advanceStatus={orders.advanceStatus}
            setStatus={orders.setStatus}
            markPaid={orders.markPaid}
            onReject={(orderId) => orders.setRejectModal(orderId)}
            handleLoadMore={orders.handleLoadMore}
          />
        )}

        {activeTab === "produtos" && (
          <ProductsTab
            products={products.products}
            filteredProducts={products.filteredProducts}
            productsLoading={products.productsLoading}
            productsError={products.productsError}
            productSearch={products.productSearch}
            setProductSearch={products.setProductSearch}
            productCategory={products.productCategory}
            setProductCategory={products.setProductCategory}
            dbCategories={dbCategories}
            togglingId={products.togglingId}
            openNewProduct={products.openNewProduct}
            openEditProduct={products.openEditProduct}
            handleToggleActive={products.handleToggleActive}
          />
        )}

        {activeTab === "relatorios" && (
          <AdminReports
            reportData={reportData}
            loading={reportsLoading}
            error={reportsError}
            period={period}
            setPeriod={setPeriod}
            refresh={refreshReports}
          />
        )}

        {activeTab === "loja" && <AdminStore />}
        {activeTab === "pdv" && <AdminPDV />}
        {activeTab === "estoque" && <AdminStock />}
      </div>
    </div>
  );
}
