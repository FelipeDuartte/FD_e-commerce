import { useCallback, useEffect, useReducer, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase/Supabaseclient";
import "./Admin.css";
import {
  PAGE_SIZE,
  CATEGORIES,
  EMPTY_PRODUCT,
  formatBRL,
  useVariableVirtualList,
  playNotificationSound,
  shouldRemoveOrder,
  getNext,
} from "./adminUtils";
import {
  buildProductPayload,
  listAdminProducts,
  saveAdminProduct,
  toggleAdminProductActive,
  validateProductPayload,
} from "./services/adminProductService";
import {
  getTodayOrderMetrics,
  listAdminOrders,
  rejectAdminOrder,
  updateAdminOrderStatus,
} from "./services/adminOrderService";
import OrderCard from "./OrderCard";
import ProductModal from "./ProductModal";
import RejectModal from "./RejectModal";
import AdminReports from "./AdminReports";
import { useAdminReports } from "./hooks/useAdminReports";

// ── Reducer métricas ──────────────────────────────────
const metricsReducer = (_, { count, total }) => ({ count, total });

export default function Admin({ user, isAdmin }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("pedidos");

  // ── Estados de pedidos ────────────────────────────
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [ordersError, setOrdersError] = useState("");
  const [updating, setUpdating] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [metrics, dispatchMetrics] = useReducer(metricsReducer, {
    count: 0,
    total: 0,
  });
  const [rejectModal, setRejectModal] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState("");

  // ── Relatórios ────────────────────────────────────
  const {
    reportData,
    loading: reportsLoading,
    error: reportsError,
    period,
    setPeriod,
    refresh: refreshReports,
  } = useAdminReports(activeTab === "relatorios");

  // ── Estados de produtos ───────────────────────────
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productCategory, setProductCategory] = useState("todos");
  const [productModal, setProductModal] = useState(null);
  const [modalForm, setModalForm] = useState(EMPTY_PRODUCT);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [togglingId, setTogglingId] = useState(null);

  // ── Fetch produtos ────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductsError("");
    try {
      setProducts(await listAdminProducts());
    } catch (error) {
      console.error(error);
      setProductsError(error.message);
    }
    setProductsLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activeTab === "produtos" && products.length === 0) fetchProducts();
  }, [activeTab, fetchProducts, products.length]);

  const filteredProducts = products.filter((p) => {
    const matchSearch = p.name
      .toLowerCase()
      .includes(productSearch.toLowerCase());
    const matchCategory =
      productCategory === "todos" || p.category === productCategory;
    return matchSearch && matchCategory;
  });

  // ── Modal de produto ──────────────────────────────
  const openNewProduct = () => {
    setModalForm(EMPTY_PRODUCT);
    setModalError("");
    setProductModal("new");
  };

  const openEditProduct = (product) => {
    setModalForm({ ...product, old_price: product.old_price ?? "" });
    setModalError("");
    setProductModal(product);
  };

  const handleModalChange = ({ target: { name, value, type, checked } }) => {
    setModalForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleModalSave = async (e) => {
    e.preventDefault();
    setModalSaving(true);
    setModalError("");

    const row = buildProductPayload(modalForm);
    const validationError = validateProductPayload(row);

    if (validationError) {
      setModalError(validationError);
      setModalSaving(false);
      return;
    }

    const isNew = productModal === "new";
    try {
      await saveAdminProduct(row, isNew);
      await fetchProducts();
      setProductModal(null);
    } catch (error) {
      console.error(error);
      setModalError(error.message);
    }

    setModalSaving(false);
  };

  const handleToggleActive = async (product) => {
    setTogglingId(product.id);
    setProductsError("");
    try {
      const updatedProduct = await toggleAdminProductActive(product);
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? updatedProduct : p)),
      );
    } catch (error) {
      console.error(error);
      setProductsError(error.message);
    }
    setTogglingId(null);
  };

  // ── Métricas ──────────────────────────────────────
  const fetchTodayMetrics = useCallback(async () => {
    try {
      dispatchMetrics(await getTodayOrderMetrics());
    } catch (error) {
      console.error(error);
    }
  }, []);

  // ── Fetch pedidos ─────────────────────────────────
  const fetchOrders = useCallback(
    async (pageNum = 0, reset = false) => {
      pageNum === 0 ? setLoading(true) : setLoadingMore(true);
      setOrdersError("");
      try {
        const result = await listAdminOrders({
          page: pageNum,
          status: filterStatus,
        });
        setOrders((prev) =>
          reset || pageNum === 0
            ? result.orders
            : [...prev, ...result.orders],
        );
        setHasMore(result.hasMore);
        setTotalCount(result.count);
      } catch (error) {
        console.error(error);
        setOrdersError(error.message);
      }
      pageNum === 0 ? setLoading(false) : setLoadingMore(false);
    },
    [filterStatus],
  );

  useEffect(() => {
    if (!isAdmin) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOrders(0, true);
    fetchTodayMetrics();
  }, [isAdmin, fetchOrders, fetchTodayMetrics]);

  // Realtime: novos pedidos e cancelamentos
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        () => {
          playNotificationSound();
          fetchOrders(0, true);
          fetchTodayMetrics();
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "orders" },
        () => {
          fetchOrders(0, true);
          fetchTodayMetrics();
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [isAdmin]); // eslint-disable-line

  // Reset ao mudar filtro
  useEffect(() => {
    if (!isAdmin) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(0);
    setOrders([]);
    setHasMore(true);
    fetchOrders(0, true);
  }, [filterStatus]); // eslint-disable-line

  // Verificar e remover pedidos antigos entregues (a cada 1 minuto)
  useEffect(() => {
    if (!isAdmin) return;
    const interval = setInterval(() => {
      setOrders((prev) => {
        const updated = prev.filter((o) => !shouldRemoveOrder(o));
        const removed = prev.length - updated.length;
        if (removed > 0) {
          setTotalCount((count) => Math.max(0, count - removed));
        }
        return updated;
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  // ── Ações de pedidos ──────────────────────────────
  const updateOrderStatusLocally = useCallback(
    (orderId, newStatus) =>
      setOrders((prev) => {
        const updated = prev.reduce((acc, o) => {
          if (o.id !== orderId) return [...acc, o];
          const nextOrder = { ...o, status: newStatus };
          return shouldRemoveOrder(nextOrder) ? acc : [...acc, nextOrder];
        }, []);
        if (updated.length !== prev.length) {
          setTotalCount((count) => Math.max(0, count - 1));
        }
        return updated;
      }),
    [],
  );

  const advanceStatus = useCallback(
    async (order) => {
      const next = getNext(order);
      if (!next) return;
      setUpdating(order.id);
      setOrdersError("");
      try {
        await updateAdminOrderStatus(order.id, next);
        updateOrderStatusLocally(order.id, next);
      } catch (error) {
        console.error(error);
        setOrdersError(error.message);
      }
      setUpdating(null);
    },
    [updateOrderStatusLocally],
  );

  const setStatus = useCallback(
    async (orderId, newStatus) => {
      setUpdating(orderId);
      setOrdersError("");
      try {
        await updateAdminOrderStatus(orderId, newStatus);
        updateOrderStatusLocally(orderId, newStatus);
      } catch (error) {
        console.error(error);
        setOrdersError(error.message);
      }
      setUpdating(null);
    },
    [updateOrderStatusLocally],
  );

  const confirmReject = useCallback(async () => {
    if (!rejectModal) return;
    setRejecting(true);
    setRejectError("");

    try {
      await rejectAdminOrder(rejectModal);
    } catch (error) {
      console.error(error);
      setRejectError(error.message);
      setRejecting(false);
      return;
    }

    setOrders((prev) => prev.filter((o) => o.id !== rejectModal));
    setTotalCount((prev) => prev - 1);
    setRejectModal(null);
    setRejecting(false);
  }, [rejectModal]);

  const closeRejectModal = useCallback(() => {
    if (!rejecting) {
      setRejectModal(null);
      setRejectError("");
    }
  }, [rejecting]);

  const handleLoadMore = useCallback(() => {
    const next = page + 1;
    setPage(next);
    fetchOrders(next);
  }, [page, fetchOrders]);

  const counts = orders.reduce(
    (acc, o) => {
      acc.all++;
      if (o.status in acc) acc[o.status]++;
      return acc;
    },
    { all: 0, pending: 0, preparing: 0, on_the_way: 0, delivered: 0 },
  );

  const { containerRef, totalHeight, offsets, start, end, measureRef } =
    useVariableVirtualList(orders.length, 90, 3);

  // ── Guards ────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────
  return (
    <div className="adm-root">
      <div className="adm-wrap">
        {/* MODAL — REJEITAR PEDIDO */}
        {rejectModal && (
          <RejectModal
            rejectModal={rejectModal}
            closeRejectModal={closeRejectModal}
            confirmReject={confirmReject}
            rejectError={rejectError}
            rejecting={rejecting}
          />
        )}

        {/* MODAL — PRODUTO */}
        {productModal && (
          <ProductModal
            productModal={productModal}
            modalForm={modalForm}
            modalSaving={modalSaving}
            modalError={modalError}
            handleModalChange={handleModalChange}
            handleModalSave={handleModalSave}
            setProductModal={setProductModal}
          />
        )}

        {/* HEADER */}
        <header className="adm-header">
          <div className="adm-header-left">
            <div className="adm-logo">
              <span className="adm-logo-dudu">Dudu</span>
              <span className="adm-logo-bebidas">Bebidas</span>
            </div>
            <div className="adm-badge">ADMIN</div>
          </div>
          <div className="adm-header-right">
            <span className="adm-admin-email">👤 Dudu bebidas</span>
            <button className="adm-btn-back" onClick={() => navigate("/")}>
              ← Voltar à loja
            </button>
          </div>
        </header>

        {/* ABAS */}
        <div className="adm-tabs">
          {[
            { key: "pedidos", label: "📦 Pedidos", badge: orders.length },
            { key: "produtos", label: "🍺 Produtos", badge: products.length },
            { key: "relatorios", label: "📊 Relatórios", badge: null },
          ].map(({ key, label, badge }) => (
            <button
              key={key}
              className={`adm-tab ${activeTab === key ? "adm-tab-active" : ""}`}
              onClick={() => setActiveTab(key)}
            >
              {label}
              {badge != null && badge > 0 && (
                <span className="adm-tab-badge">{badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ══ ABA PEDIDOS ══ */}
        {activeTab === "pedidos" && (
          <>
            <div className="adm-title-row">
              <div>
                <h1 className="adm-title">Painel de Pedidos</h1>
                <p className="adm-subtitle">
                  {orders.length} pedido(s) · tempo real
                </p>
              </div>
              <div className="adm-realtime-dot" aria-label="Tempo real">
                <span className="adm-dot-pulse" />
                <span>Ao vivo</span>
              </div>
            </div>

            <div className="adm-today-metrics">
              {[
                { icon: "📅", value: metrics.count, label: "Pedidos hoje" },
                {
                  icon: "💰",
                  value: formatBRL(metrics.total),
                  label: "Vendas hoje",
                },
              ].map(({ icon, value, label }) => (
                <div key={label} className="adm-metric-card">
                  <div className="adm-metric-icon">{icon}</div>
                  <div className="adm-metric-content">
                    <span className="adm-metric-value">{value}</span>
                    <span className="adm-metric-label">{label}</span>
                  </div>
                </div>
              ))}
            </div>

            <div
              className="adm-stats"
              role="group"
              aria-label="Filtrar por status"
            >
              {[
                { key: "all", icon: null, num: counts.all, label: "Total" },
                {
                  key: "pending",
                  icon: "🕐",
                  num: counts.pending,
                  label: "Aguardando",
                },
                {
                  key: "preparing",
                  icon: "👨‍🍳",
                  num: counts.preparing,
                  label: "Preparando",
                },
                {
                  key: "on_the_way",
                  icon: "🛵",
                  num: counts.on_the_way,
                  label: "Em entrega",
                },
                {
                  key: "delivered",
                  icon: "✅",
                  num: counts.delivered,
                  label: "Entregue",
                },
              ].map(({ key, icon, num, label }) => (
                <button
                  key={key}
                  className={`adm-stat adm-stat-${key} ${filterStatus === key ? "adm-stat-active" : ""}`}
                  onClick={() => setFilterStatus(key)}
                  aria-pressed={filterStatus === key}
                >
                  {icon && <span className="adm-stat-icon">{icon}</span>}
                  <span className="adm-stat-num">{num}</span>
                  <span className="adm-stat-label">{label}</span>
                </button>
              ))}
            </div>

            {ordersError ? (
              <div className="adm-modal-error">⚠️ {ordersError}</div>
            ) : loading ? (
              <div className="adm-loading">
                <div className="adm-spinner" />
                <p>Carregando pedidos...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="adm-empty">
                <p>Nenhum pedido encontrado.</p>
              </div>
            ) : (
              <>
                <div ref={containerRef} className="adm-virtual-container">
                  <div style={{ height: totalHeight, position: "relative" }}>
                    {orders.slice(start, end + 1).map((order, relIdx) => {
                      const absIdx = start + relIdx;
                      return (
                        <div
                          key={order.id}
                          ref={measureRef(absIdx)}
                          style={{
                            position: "absolute",
                            top: offsets[absIdx],
                            left: 0,
                            right: 0,
                          }}
                        >
                          <OrderCard
                            order={order}
                            isExpanded={expandedId === order.id}
                            isUpdating={updating === order.id}
                            onToggle={() =>
                              setExpandedId((p) =>
                                p === order.id ? null : order.id,
                              )
                            }
                            onAccept={() => advanceStatus(order)}
                            onReject={() => setRejectModal(order.id)}
                            onAdvance={() => advanceStatus(order)}
                            onSetStatus={(s) => setStatus(order.id, s)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {hasMore && (
                  <div className="adm-load-more-wrap">
                    <button
                      className="adm-load-more"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                    >
                      {loadingMore ? (
                        <>
                          <div className="adm-spinner-sm" /> Carregando...
                        </>
                      ) : (
                        `Carregar mais (${orders.length} de ${totalCount})`
                      )}
                    </button>
                  </div>
                )}

                {!hasMore && orders.length > PAGE_SIZE && (
                  <div className="adm-end-msg">
                    ✓ Todos os {totalCount} pedidos carregados
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ══ ABA PRODUTOS ══ */}
        {activeTab === "produtos" && (
          <>
            <div className="adm-title-row">
              <div>
                <h1 className="adm-title">Gestão de Produtos</h1>
                <p className="adm-subtitle">
                  {filteredProducts.length} de {products.length} produtos
                </p>
              </div>
              <button className="adm-btn-new-product" onClick={openNewProduct}>
                + Novo Produto
              </button>
            </div>

            <div className="adm-product-filters">
              <input
                className="adm-product-search"
                placeholder="🔍 Buscar produto..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
              <select
                className="adm-product-cat-filter"
                value={productCategory}
                onChange={(e) => setProductCategory(e.target.value)}
              >
                <option value="todos">Todas categorias</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {productsError && (
              <div className="adm-modal-error">⚠️ {productsError}</div>
            )}

            {productsLoading ? (
              <div className="adm-loading">
                <div className="adm-spinner" />
                <p>Carregando produtos...</p>
              </div>
            ) : (
              <div className="adm-product-table-wrap">
                <table className="adm-product-table">
                  <thead>
                    <tr>
                      {[
                        "ID",
                        "Nome",
                        "Categoria",
                        "Preço",
                        "Estoque",
                        "Status",
                        "Ações",
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((p) => (
                      <tr
                        key={p.id}
                        className={!p.is_active ? "adm-row-inactive" : ""}
                      >
                        <td className="adm-td-id">{p.id}</td>
                        <td className="adm-td-name">{p.name}</td>
                        <td>
                          <span className="adm-cat-badge">{p.category}</span>
                        </td>
                        <td>{formatBRL(p.price)}</td>
                        <td>
                          <span
                            className={`adm-stock-badge ${p.stock === 0 ? "zero" : p.stock < 10 ? "low" : "ok"}`}
                          >
                            {p.stock}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`adm-status-pill ${p.is_active ? "active" : "inactive"}`}
                          >
                            {p.is_active ? "✅ Ativo" : "🚫 Inativo"}
                          </span>
                        </td>
                        <td className="adm-td-actions">
                          <button
                            className="adm-btn-edit"
                            onClick={() => openEditProduct(p)}
                          >
                            ✏️ Editar
                          </button>
                          <button
                            className={`adm-btn-toggle ${p.is_active ? "deactivate" : "activate"}`}
                            onClick={() => handleToggleActive(p)}
                            disabled={togglingId === p.id}
                          >
                            {togglingId === p.id
                              ? "..."
                              : p.is_active
                                ? "🚫 Desativar"
                                : "✅ Ativar"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredProducts.length === 0 && (
                  <div className="adm-empty">
                    <p>Nenhum produto encontrado.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {/* ══ ABA RELATÓRIOS ══ */}
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
      </div>
    </div>
  );
}
