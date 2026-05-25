import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase/Supabaseclient";
import "./Admin.css";

// ── Constantes ────────────────────────────────────────
const PAGE_SIZE = 20;

const STATUS_PICKUP = {
  pending: {
    label: "Aguardando",
    icon: "🕐",
    color: "#ffd000",
    next: "delivered",
  },
  delivered: { label: "Entregue", icon: "✅", color: "#50c878", next: null },
};

const STATUS_DELIVERY = {
  pending: {
    label: "Aguardando",
    icon: "🕐",
    color: "#ffd000",
    next: "preparing",
  },
  preparing: {
    label: "Preparando",
    icon: "👨‍🍳",
    color: "#ff8c00",
    next: "on_the_way",
  },
  on_the_way: {
    label: "Em entrega",
    icon: "🛵",
    color: "#50c878",
    next: "delivered",
  },
  delivered: { label: "Entregue", icon: "✅", color: "#aaa", next: null },
};

const DELIVERY_STATUS_ORDER = [
  "pending",
  "preparing",
  "on_the_way",
  "delivered",
];
const PICKUP_STATUS_ORDER = ["pending", "delivered"];

const PAYMENT_LABEL = {
  pix: { icon: "⚡", label: "PIX" },
  card: { icon: "💳", label: "Cartão" },
  cash: { icon: "💵", label: "Dinheiro" },
};

const CATEGORIES = [
  "cerveja",
  "vinho",
  "destilado",
  "refrigerante",
  "energetico",
  "outros",
];

const EMPTY_PRODUCT = {
  id: "",
  name: "",
  category: "cerveja",
  price: "",
  old_price: "",
  image: "",
  stock: "",
  is_active: true,
  promotion: false,
  supplier: "",
  ean: "",
};

// ── Helpers ───────────────────────────────────────────
const isPickup = (order) => order.address?.isRetirada === true;
const getStatusMap = (order) =>
  isPickup(order) ? STATUS_PICKUP : STATUS_DELIVERY;
const getConfig = (order) =>
  getStatusMap(order)[order.status] ?? STATUS_DELIVERY.pending;
const getStatuses = (order) =>
  isPickup(order) ? PICKUP_STATUS_ORDER : DELIVERY_STATUS_ORDER;
const getNext = (order) => getConfig(order).next;

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatBRL = (value) => `R$ ${Number(value).toFixed(2).replace(".", ",")}`;

const calcDiscount = (oldPrice, newPrice) =>
  oldPrice > 0 ? Math.round((1 - newPrice / oldPrice) * 100) : null;

// ── Reducer métricas ──────────────────────────────────
const metricsReducer = (_, { count, total }) => ({ count, total });

// ── Virtualização ─────────────────────────────────────
const GAP = 10;

function useVariableVirtualList(count, estimatedItemHeight = 90, overscan = 3) {
  const containerRef = useRef(null);
  const heightsRef = useRef({});
  const observersRef = useRef({});
  const [, forceUpdate] = useReducer((n) => n + 1, 0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(700);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setViewH(e.contentRect.height));
    const onScroll = () => setScrollTop(el.scrollTop);
    ro.observe(el);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Pré-calcula offsets acumulados
  const offsets = [];
  let acc = 0;
  for (let i = 0; i < count; i++) {
    offsets.push(acc);
    acc += (heightsRef.current[i] ?? estimatedItemHeight) + GAP;
  }
  const totalHeight = acc;

  // Janela visível
  const threshold = overscan * estimatedItemHeight;
  let start = 0;
  while (start < count - 1 && offsets[start + 1] <= scrollTop - threshold)
    start++;
  let end = start;
  while (end < count - 1 && offsets[end] <= scrollTop + viewH + threshold)
    end++;

  const measureRef = useCallback(
    (index) => (el) => {
      observersRef.current[index]?.disconnect();
      delete observersRef.current[index];
      if (!el) return;
      const ro = new ResizeObserver(([e]) => {
        const h = Math.round(e.contentRect.height);
        if (heightsRef.current[index] !== h) {
          heightsRef.current[index] = h;
          forceUpdate();
        }
      });
      ro.observe(el);
      observersRef.current[index] = ro;
    },
    [forceUpdate],
  );

  useEffect(() => {
    const obs = observersRef.current;
    return () => Object.values(obs).forEach((ro) => ro.disconnect());
  }, []);

  return { containerRef, totalHeight, offsets, start, end, measureRef };
}

function playNotificationSound() {
  try {
    const a = new Audio("/notification.mp3");
    a.volume = 1;
    a.play().catch(() => {});
  } catch {}
}

// ══════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════
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
  const [updating, setUpdating] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const [metrics, dispatchMetrics] = useReducer(metricsReducer, {
    count: 0,
    total: 0,
  });
  const [now, setNow] = useState(Date.now());
  const [rejectModal, setRejectModal] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState("");

  // ── Estados de produtos ───────────────────────────
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
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
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name");
    if (!error) setProducts(data ?? []);
    setProductsLoading(false);
  }, []);

  useEffect(() => {
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

    const oldPrice =
      modalForm.old_price !== "" ? Number(modalForm.old_price) : null;
    const newPrice = Number(modalForm.price);

    const row = {
      id: String(modalForm.id).trim(),
      name: modalForm.name.trim(),
      category: modalForm.category,
      price: newPrice,
      old_price: modalForm.promotion ? oldPrice : null,
      discount: modalForm.promotion ? calcDiscount(oldPrice, newPrice) : null,
      image: modalForm.image || null,
      stock: Number(modalForm.stock),
      is_active: modalForm.is_active,
      promotion: modalForm.promotion,
      supplier: modalForm.supplier || null,
      ean: modalForm.ean || null,
    };

    if (!row.id || !row.name || isNaN(row.price) || isNaN(row.stock)) {
      setModalError("Preencha ID, nome, preço e estoque.");
      setModalSaving(false);
      return;
    }

    const isNew = productModal === "new";
    const { error } = isNew
      ? await supabase.from("products").insert(row)
      : await supabase.from("products").update(row).eq("id", row.id);

    if (error) setModalError(error.message);
    else {
      await fetchProducts();
      setProductModal(null);
    }

    setModalSaving(false);
  };

  const handleToggleActive = async (product) => {
    setTogglingId(product.id);
    await supabase
      .from("products")
      .update({ is_active: !product.is_active })
      .eq("id", product.id);
    setProducts((prev) =>
      prev.map((p) =>
        p.id === product.id ? { ...p, is_active: !p.is_active } : p,
      ),
    );
    setTogglingId(null);
  };

  // ── Métricas ──────────────────────────────────────
  const fetchTodayMetrics = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const { data, count, error } = await supabase
      .from("orders")
      .select("total", { count: "exact" })
      .gte("created_at", today.toISOString())
      .lt("created_at", tomorrow.toISOString());
    if (!error && data)
      dispatchMetrics({
        count: count ?? 0,
        total: data.reduce((s, o) => s + (o.total ?? 0), 0),
      });
  }, []);

  // ── Fetch pedidos ─────────────────────────────────
  const fetchOrders = useCallback(
    async (pageNum = 0, reset = false) => {
      pageNum === 0 ? setLoading(true) : setLoadingMore(true);
      const from = pageNum * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("orders")
        .select(
          `id, total, payment_method, address, status, created_at, updated_at,
         order_items ( id, name, price, quantity )`,
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (filterStatus !== "all") query = query.eq("status", filterStatus);

      const { data, error, count } = await query;
      if (!error) {
        setOrders((prev) =>
          reset || pageNum === 0 ? (data ?? []) : [...prev, ...(data ?? [])],
        );
        setHasMore((data ?? []).length === PAGE_SIZE);
        if (count !== null) setTotalCount(count);
      }
      pageNum === 0 ? setLoading(false) : setLoadingMore(false);
    },
    [filterStatus],
  );

  useEffect(() => {
    if (!isAdmin) return;
    fetchOrders(0, true);
    fetchTodayMetrics();
  }, [isAdmin, fetchOrders, fetchTodayMetrics]);

  // Realtime: novos pedidos
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
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [isAdmin]); // eslint-disable-line

  // Reset ao mudar filtro
  useEffect(() => {
    if (!isAdmin) return;
    setPage(0);
    setOrders([]);
    setHasMore(true);
    fetchOrders(0, true);
  }, [filterStatus]); // eslint-disable-line

  // ── Ações de pedidos ──────────────────────────────
  const updateOrderStatusLocally = useCallback(
    (orderId, newStatus) =>
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, status: newStatus, updated_at: new Date().toISOString() }
            : o,
        ),
      ),
    [setOrders],
  );

  const advanceStatus = useCallback(
    async (order) => {
      const next = getNext(order);
      if (!next) return;
      setUpdating(order.id);
      const { error } = await supabase
        .from("orders")
        .update({ status: next })
        .eq("id", order.id);
      if (!error) updateOrderStatusLocally(order.id, next);
      setUpdating(null);
    },
    [updateOrderStatusLocally],
  );

  const setStatus = useCallback(
    async (orderId, newStatus) => {
      setUpdating(orderId);
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);
      if (!error) updateOrderStatusLocally(orderId, newStatus);
      setUpdating(null);
    },
    [updateOrderStatusLocally],
  );

  const confirmReject = useCallback(async () => {
    if (!rejectModal) return;
    setRejecting(true);
    setRejectError("");

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "restore_stock",
      {
        p_order_id: rejectModal,
      },
    );

    if (rpcError || !rpcResult?.success) {
      setRejectError(
        rpcError
          ? "Erro ao restaurar estoque."
          : (rpcResult?.error ?? "Erro ao restaurar estoque."),
      );
      setRejecting(false);
      return;
    }

    const { error: itemsErr } = await supabase
      .from("order_items")
      .delete()
      .eq("order_id", rejectModal);
    if (itemsErr) {
      setRejectError("Erro ao remover itens.");
      setRejecting(false);
      return;
    }

    const { error: orderErr } = await supabase
      .from("orders")
      .delete()
      .eq("id", rejectModal);
    if (orderErr) {
      setRejectError("Erro ao rejeitar pedido.");
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

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const isDeliveredTooOld = useCallback(
    (order) => {
      if (order.status !== "delivered" || !order.updated_at) return false;
      return now - new Date(order.updated_at).getTime() >= 24 * 60 * 60 * 1000;
    },
    [now],
  );

  const visibleOrders = orders.filter((order) => !isDeliveredTooOld(order));

  const handleLoadMore = useCallback(() => {
    const next = page + 1;
    setPage(next);
    fetchOrders(next);
  }, [page, fetchOrders]);

  const counts = visibleOrders.reduce(
    (acc, o) => {
      acc.all++;
      if (o.status in acc) acc[o.status]++;
      return acc;
    },
    { all: 0, pending: 0, preparing: 0, on_the_way: 0, delivered: 0 },
  );

  const { containerRef, totalHeight, offsets, start, end, measureRef } =
    useVariableVirtualList(visibleOrders.length, 90, 3);

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
          <>
            <div className="adm-modal-overlay" onClick={closeRejectModal} />
            <div className="adm-modal" role="dialog" aria-modal="true">
              <div className="adm-modal-icon">🚫</div>
              <h3 className="adm-modal-title">Rejeitar pedido?</h3>
              <p className="adm-modal-desc">
                Tem certeza que deseja <strong>rejeitar</strong> o pedido{" "}
                <strong>#{rejectModal.slice(-8).toUpperCase()}</strong>? Será{" "}
                <strong>apagado permanentemente</strong>.
              </p>
              {rejectError && (
                <div className="adm-modal-error">⚠️ {rejectError}</div>
              )}
              <div className="adm-modal-actions">
                <button
                  className="adm-modal-btn-back"
                  onClick={closeRejectModal}
                  disabled={rejecting}
                >
                  Cancelar
                </button>
                <button
                  className="adm-modal-btn-reject"
                  onClick={confirmReject}
                  disabled={rejecting}
                >
                  {rejecting ? "Rejeitando..." : "Sim, rejeitar"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* MODAL — PRODUTO */}
        {productModal && (
          <>
            <div
              className="adm-modal-overlay"
              onClick={() => !modalSaving && setProductModal(null)}
            />
            <div
              className="adm-modal adm-modal-product"
              role="dialog"
              aria-modal="true"
            >
              <div className="adm-modal-icon">
                {productModal === "new" ? "➕" : "✏️"}
              </div>
              <h3 className="adm-modal-title">
                {productModal === "new" ? "Novo Produto" : "Editar Produto"}
              </h3>

              <form onSubmit={handleModalSave} className="adm-product-form">
                <div className="adm-form-row">
                  <div className="adm-form-field">
                    <label>ID (código)</label>
                    <input
                      name="id"
                      value={modalForm.id}
                      onChange={handleModalChange}
                      disabled={productModal !== "new"}
                      placeholder="ex: 000468"
                      required
                    />
                  </div>
                  <div className="adm-form-field">
                    <label>Categoria</label>
                    <select
                      name="category"
                      value={modalForm.category}
                      onChange={handleModalChange}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="adm-form-field">
                  <label>Nome</label>
                  <input
                    name="name"
                    value={modalForm.name}
                    onChange={handleModalChange}
                    placeholder="Nome do produto"
                    required
                  />
                </div>

                <div className="adm-form-row">
                  <div className="adm-form-field">
                    <label>Preço (R$)</label>
                    <input
                      name="price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={modalForm.price}
                      onChange={handleModalChange}
                      required
                    />
                  </div>
                  <div className="adm-form-field">
                    <label>Estoque</label>
                    <input
                      name="stock"
                      type="number"
                      min="0"
                      value={modalForm.stock}
                      onChange={handleModalChange}
                      required
                    />
                  </div>
                </div>

                <div className="adm-form-field">
                  <label>Imagem (URL)</label>
                  <input
                    name="image"
                    value={modalForm.image ?? ""}
                    onChange={handleModalChange}
                    placeholder="https://..."
                  />
                </div>

                <div className="adm-form-row">
                  <div className="adm-form-field">
                    <label>Fornecedor</label>
                    <input
                      name="supplier"
                      value={modalForm.supplier ?? ""}
                      onChange={handleModalChange}
                    />
                  </div>
                  <div className="adm-form-field">
                    <label>EAN</label>
                    <input
                      name="ean"
                      value={modalForm.ean ?? ""}
                      onChange={handleModalChange}
                    />
                  </div>
                </div>

                <div className="adm-form-checks">
                  <label className="adm-form-check">
                    <input
                      name="is_active"
                      type="checkbox"
                      checked={modalForm.is_active}
                      onChange={handleModalChange}
                    />
                    Produto ativo
                  </label>
                  <label className="adm-form-check">
                    <input
                      name="promotion"
                      type="checkbox"
                      checked={modalForm.promotion}
                      onChange={handleModalChange}
                    />
                    Em promoção
                  </label>
                </div>
                {/* modal promocionais */}
                {modalForm.promotion && (
                  <div className="adm-promo-fields">
                    <p className="adm-promo-hint">
                      💡{" "}
                      <strong>Defina abaixo o novo preço promocional.</strong>
                    </p>
                    <div className="adm-form-row">
                      <div className="adm-form-field">
                        <label>Preço antigo (R$)</label>
                        <input
                          name="old_price"
                          type="number"
                          step="0.01"
                          min="0"
                          value={modalForm.old_price ?? ""}
                          onChange={handleModalChange}
                          placeholder="ex: 10.00"
                        />
                      </div>
                      <div className="adm-form-field">
                        <label>Preço promocional (R$)</label>
                        <input
                          name="price"
                          type="number"
                          step="0.01"
                          min="0"
                          value={modalForm.price}
                          onChange={handleModalChange}
                          placeholder="ex: 7.50"
                          required
                        />
                      </div>
                    </div>

                    {modalForm.old_price && modalForm.price && (
                      <div className="adm-promo-preview">
                        <span className="adm-preview-label">
                          Preview no card:
                        </span>
                        <span className="adm-preview-old">
                          R$ {Number(modalForm.old_price).toFixed(2)}
                        </span>
                        <span className="adm-preview-new">
                          R$ {Number(modalForm.price).toFixed(2)}
                        </span>
                        {modalForm.old_price > 0 && (
                          <span className="adm-preview-badge">
                            -
                            {calcDiscount(modalForm.old_price, modalForm.price)}
                            % OFF
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {modalError && (
                  <div className="adm-modal-error">⚠️ {modalError}</div>
                )}

                <div className="adm-modal-actions">
                  <button
                    type="button"
                    className="adm-modal-btn-back"
                    onClick={() => setProductModal(null)}
                    disabled={modalSaving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="adm-modal-btn-save"
                    disabled={modalSaving}
                  >
                    {modalSaving ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </form>
            </div>
          </>
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
            <span className="adm-admin-email">👤 {user.email}</span>
            <button className="adm-btn-back" onClick={() => navigate("/")}>
              ← Voltar à loja
            </button>
          </div>
        </header>

        {/* ABAS */}
        <div className="adm-tabs">
          {[
            { key: "pedidos", label: "📦 Pedidos", badge: totalCount },
            { key: "produtos", label: "🍺 Produtos", badge: products.length },
          ].map(({ key, label, badge }) => (
            <button
              key={key}
              className={`adm-tab ${activeTab === key ? "adm-tab-active" : ""}`}
              onClick={() => setActiveTab(key)}
            >
              {label}
              {badge > 0 && <span className="adm-tab-badge">{badge}</span>}
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
                  {totalCount} pedido(s) · mostrando {visibleOrders.length} ·
                  tempo real
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

            {loading ? (
              <div className="adm-loading">
                <div className="adm-spinner" />
                <p>Carregando pedidos...</p>
              </div>
            ) : visibleOrders.length === 0 ? (
              <div className="adm-empty">
                <p>Nenhum pedido encontrado.</p>
              </div>
            ) : (
              <>
                <div ref={containerRef} className="adm-virtual-container">
                  <div style={{ height: totalHeight, position: "relative" }}>
                    {visibleOrders
                      .slice(start, end + 1)
                      .map((order, relIdx) => {
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
                        `Carregar mais (${visibleOrders.length} de ${totalCount})`
                      )}
                    </button>
                  </div>
                )}

                {!hasMore && visibleOrders.length > PAGE_SIZE && (
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
      </div>
    </div>
  );
}

// ── Card de pedido ────────────────────────────────────
function OrderCard({
  order,
  isExpanded,
  isUpdating,
  onToggle,
  onAccept,
  onReject,
  onAdvance,
  onSetStatus,
}) {
  const pickup = isPickup(order);
  const cfg = getConfig(order);
  const nextSt = getNext(order);
  const statuses = getStatuses(order);
  const statusMap = getStatusMap(order);
  const isPending = order.status === "pending";
  const payment = PAYMENT_LABEL[order.payment_method] ?? {
    icon: "💳",
    label: order.payment_method,
  };
  const shortId = order.id.slice(-8).toUpperCase();

  return (
    <li className={`adm-order adm-order-${order.status}`}>
      <div
        className="adm-order-main"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onToggle()}
      >
        <div className="adm-order-status">
          <span className="adm-status-icon">{cfg.icon}</span>
          <span className="adm-status-label" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
          {pickup && <span className="adm-retirada-badge">🏪 RETIRADA</span>}
        </div>

        <div className="adm-order-info">
          <span className="adm-order-id">#{shortId}</span>
          <span className="adm-order-name">{order.address?.name ?? "—"}</span>
          {pickup ? (
            <span className="adm-order-retirada-info">🏪 Retirada na loja</span>
          ) : (
            <span className="adm-order-district">
              📍 {order.address?.district ?? "—"}
            </span>
          )}
        </div>

        <div className="adm-order-payment">
          <span>
            {payment.icon} {payment.label}
          </span>
          <span className="adm-order-total">{formatBRL(order.total)}</span>
        </div>

        {isPending && (
          <div
            className="adm-order-actions"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="adm-btn-accept"
              onClick={onAccept}
              disabled={isUpdating}
              title={pickup ? "Confirmar retirada" : "Aceitar pedido"}
            >
              {isUpdating ? "..." : `✓ ${pickup ? "Confirmar" : "Aceitar"}`}
            </button>
            <button
              className="adm-btn-reject"
              onClick={onReject}
              disabled={isUpdating}
            >
              ✕ Rejeitar
            </button>
          </div>
        )}

        <span className="adm-order-date">{formatDate(order.created_at)}</span>
        <span
          className={`adm-chevron ${isExpanded ? "open" : ""}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </div>

      {isExpanded && (
        <div
          className={`adm-order-detail adm-order-detail--${pickup ? "pickup" : "delivery"}`}
        >
          {/* Itens */}
          <div className="adm-detail-section">
            <div className="adm-detail-label">🛒 Itens</div>
            <div className="adm-items">
              {(order.order_items ?? []).map((item) => (
                <div className="adm-item" key={item.id}>
                  <span className="adm-item-name">{item.name}</span>
                  <span className="adm-item-qty">x{item.quantity}</span>
                  <span className="adm-item-price">
                    {formatBRL(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Endereço / Retirada */}
          <div className="adm-detail-section">
            <div className="adm-detail-label">
              {pickup ? "🏪 Informações da Retirada" : "📍 Endereço"}
            </div>
            <div className="adm-address">
              <p>
                <strong>{order.address?.name}</strong>
              </p>
              {pickup ? (
                <>
                  <p>🏪 Retirada na loja</p>
                  <p>📍 Rua Edgar Torres, 650 — Belo Horizonte/MG</p>
                </>
              ) : (
                <>
                  <p>
                    {order.address?.street}, {order.address?.number}
                    {order.address?.complement
                      ? ` — ${order.address.complement}`
                      : ""}
                  </p>
                  <p>{order.address?.district}</p>
                </>
              )}
              <p>📞 {order.address?.phone}</p>
            </div>
          </div>

          {/* Status */}
          <div className="adm-detail-section">
            <div className="adm-detail-label">
              {pickup ? "🔄 Status da Retirada" : "🔄 Alterar Status"}
            </div>

            {isPending ? (
              <div className="adm-accept-reject-detail">
                <button
                  className="adm-btn-accept-lg"
                  onClick={onAccept}
                  disabled={isUpdating}
                >
                  {isUpdating
                    ? "Processando..."
                    : `✓ ${pickup ? "Confirmar Retirada" : "Aceitar Pedido"}`}
                </button>
                <button
                  className="adm-btn-reject-lg"
                  onClick={onReject}
                  disabled={isUpdating}
                >
                  ✕ Rejeitar Pedido
                </button>
              </div>
            ) : (
              <>
                <div className="adm-status-pills">
                  {statuses.map((s) => (
                    <button
                      key={s}
                      className={`adm-pill ${order.status === s ? "adm-pill-active" : ""}`}
                      style={{ "--pill-color": statusMap[s]?.color }}
                      onClick={() => onSetStatus(s)}
                      disabled={isUpdating}
                    >
                      {statusMap[s]?.icon} {statusMap[s]?.label}
                    </button>
                  ))}
                </div>

                {nextSt ? (
                  <button
                    className="adm-btn-advance"
                    onClick={onAdvance}
                    disabled={isUpdating}
                  >
                    {isUpdating
                      ? "Atualizando..."
                      : `Avançar para: ${statusMap[nextSt]?.icon} ${statusMap[nextSt]?.label} →`}
                  </button>
                ) : (
                  <div className="adm-delivered-msg">
                    {pickup ? "✅ Retirada finalizada" : "✅ Pedido finalizado"}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
