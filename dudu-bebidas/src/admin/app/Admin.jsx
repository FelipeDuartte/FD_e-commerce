import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Admin.css";
import RejectModal from "../features/pedidos/components/RejectModal";
import AdminReports from "../features/relatorios/components/AdminReports";
import AdminStore from "../features/loja/AdminStore";
import { useAdminReports } from "../features/relatorios/hooks/useAdminReports";
import { useAdminOrders } from "../features/pedidos/hooks/useAdminOrders";
import { useTheme } from "../shared/hooks/useTheme";
import AdminHeader from "./components/AdminHeader";
import AdminTabs from "./components/AdminTabs";
import OrdersTab from "../features/pedidos/components/OrdersTab";

export default function Admin({ isAdmin }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("pedidos");
  const { theme, toggleTheme } = useTheme();

  const orders = useAdminOrders(isAdmin);

  const { reportData, loading: reportsLoading, error: reportsError, period, setPeriod, refresh: refreshReports } =
    useAdminReports(activeTab === "relatorios");

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

        <AdminHeader onBack={() => navigate("/")} theme={theme} onToggleTheme={toggleTheme} />

        <AdminTabs
          activeTab={activeTab}
          onChange={setActiveTab}
          ordersCount={orders.orders.length}
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
            onReject={(order) => orders.setRejectModal(order)}
            handleLoadMore={orders.handleLoadMore}
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
      </div>
    </div>
  );
}
