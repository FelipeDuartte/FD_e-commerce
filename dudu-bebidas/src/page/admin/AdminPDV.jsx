import { useCallback, useEffect, useMemo, useState } from "react";
import "./AdminPDV.css";
import { formatBRL } from "./adminUtils";
import { listAdminProducts } from "./services/adminProductService";
import {
  getOpenCashSession,
  openCashSession,
  closeCashSession,
  createPdvSale,
} from "./services/adminPDVService";

const PAYMENT_METHODS = [
  { value: "cash", icon: "💵", label: "Dinheiro" },
  { value: "pix", icon: "⚡", label: "PIX" },
  { value: "debit_card", icon: "💳", label: "Débito" },
  { value: "credit_card", icon: "💳", label: "Crédito" },
];

export default function AdminPDV() {
  // ── Sessão de caixa ────────────────────────────────
  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [openingAmountInput, setOpeningAmountInput] = useState("");
  const [openingSession, setOpeningSession] = useState(false);
  const [sessionError, setSessionError] = useState("");

  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [declaredAmountInput, setDeclaredAmountInput] = useState("");
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState("");
  const [closeResult, setCloseResult] = useState(null);

  // ── Produtos ───────────────────────────────────────
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [search, setSearch] = useState("");

  // ── Carrinho / venda ───────────────────────────────
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [submitting, setSubmitting] = useState(false);
  const [saleError, setSaleError] = useState("");
  const [saleSuccess, setSaleSuccess] = useState("");
  const [sessionSales, setSessionSales] = useState([]);

  const loadSession = useCallback(async () => {
    setSessionLoading(true);
    try {
      setSession(await getOpenCashSession());
      setSessionError("");
    } catch (e) {
      setSessionError(e.message);
    }
    setSessionLoading(false);
  }, []);

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      setProducts(await listAdminProducts());
      setProductsError("");
    } catch (e) {
      setProductsError(e.message);
    }
    setProductsLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSession();
      loadProducts();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadSession, loadProducts]);

  // ── Abrir caixa ────────────────────────────────────
  const handleOpenSession = async () => {
    const amount = Number(openingAmountInput);
    if (!Number.isFinite(amount) || amount < 0) {
      setSessionError("Informe um valor inicial válido.");
      return;
    }
    setOpeningSession(true);
    setSessionError("");
    try {
      setSession(await openCashSession(amount));
      setOpeningAmountInput("");
    } catch (e) {
      setSessionError(e.message);
    }
    setOpeningSession(false);
  };

  // ── Fechar caixa ───────────────────────────────────
  const handleCloseSession = async () => {
    const amount = Number(declaredAmountInput);
    if (!Number.isFinite(amount) || amount < 0) {
      setCloseError("Informe um valor válido.");
      return;
    }
    setClosing(true);
    setCloseError("");
    try {
      const result = await closeCashSession(session.id, amount);
      setCloseResult(result);
      setSession(null);
      setSessionSales([]);
    } catch (e) {
      setCloseError(e.message);
    }
    setClosing(false);
  };

  const resetCloseModal = () => {
    setCloseModalOpen(false);
    setDeclaredAmountInput("");
    setCloseError("");
    setCloseResult(null);
  };

  // ── Carrinho ───────────────────────────────────────
  const addToCart = (product) => {
    if (product.stock <= 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((i) =>
          i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        { id: product.id, name: product.name, price: product.price, quantity: 1, stock: product.stock },
      ];
    });
  };

  const updateQuantity = (id, quantity) => {
    setCart((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, quantity: Math.max(1, Math.min(quantity, i.stock)) } : i
      )
    );
  };

  const removeFromCart = (id) => setCart((prev) => prev.filter((i) => i.id !== id));
  const clearCart = () => setCart([]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [cart]
  );

  // ── Busca de produto (nome, código de barras ou id) ─
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products
      .filter((p) => p.is_active && p.stock > 0)
      .filter(
        (p) =>
          !term ||
          p.name.toLowerCase().includes(term) ||
          p.id.toLowerCase().includes(term) ||
          (p.ean ?? "").toLowerCase() === term
      );
  }, [products, search]);

  // ── Finalizar venda ────────────────────────────────
  const handleFinalizeSale = async () => {
    if (cart.length === 0 || !session) return;
    setSubmitting(true);
    setSaleError("");
    try {
      const result = await createPdvSale({
        cartItems: cart.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity })),
        paymentMethod,
        cashSessionId: session.id,
      });
      setSessionSales((prev) => [...prev, { orderId: result.orderId, total: cartTotal, paymentMethod }]);
      setSaleSuccess(`Venda registrada — ${formatBRL(cartTotal)}`);
      setTimeout(() => setSaleSuccess(""), 3000);
      clearCart();
      setPaymentMethod("cash");
      loadProducts(); // estoque mudou, recarrega pra não deixar badge desatualizado
    } catch (e) {
      setSaleError(e.message);
    }
    setSubmitting(false);
  };

  // ── Render ─────────────────────────────────────────
  if (sessionLoading) {
    return (
      <div className="adm-loading">
        <div className="adm-spinner" />
        <p>Verificando caixa...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <>
        <div className="adm-title-row">
          <div>
            <h1 className="adm-title">PDV — Venda de Balcão</h1>
            <p className="adm-subtitle">Abra o caixa para começar a vender.</p>
          </div>
        </div>
        <div className="pdv-open-session">
          {sessionError && <div className="adm-modal-error">⚠️ {sessionError}</div>}
          <div className="adm-form-field">
            <label>Valor inicial em caixa (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={openingAmountInput}
              onChange={(e) => setOpeningAmountInput(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <button
            className="adm-btn-new-product"
            onClick={handleOpenSession}
            disabled={openingSession}
          >
            {openingSession ? "Abrindo..." : "🧾 Abrir caixa"}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="adm-title-row">
        <div>
          <h1 className="adm-title">PDV — Venda de Balcão</h1>
          <p className="adm-subtitle">
            Caixa aberto às {new Date(session.opened_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            {" · "}{sessionSales.length} venda(s) nesta sessão
          </p>
        </div>
        <button className="adm-btn-back" onClick={() => setCloseModalOpen(true)}>
          🔒 Fechar caixa
        </button>
      </div>

      {saleSuccess && <div className="adm-store-success">✅ {saleSuccess}</div>}
      {saleError && <div className="adm-modal-error">⚠️ {saleError}</div>}

      <div className="pdv-layout">
        <div className="pdv-catalog">
          <input
            className="adm-product-search"
            placeholder="🔍 Buscar por nome ou código de barras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />

          {productsError && <div className="adm-modal-error">⚠️ {productsError}</div>}

          {productsLoading ? (
            <div className="adm-loading">
              <div className="adm-spinner" />
              <p>Carregando produtos...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="adm-empty"><p>Nenhum produto encontrado.</p></div>
          ) : (
            <div className="pdv-product-grid">
              {filteredProducts.map((p) => (
                <button key={p.id} className="pdv-product-card" onClick={() => addToCart(p)}>
                  <span className="pdv-product-name">{p.name}</span>
                  <span className="pdv-product-price">{formatBRL(p.price)}</span>
                  <span className={`adm-stock-badge ${p.stock < 10 ? "low" : "ok"}`}>
                    {p.stock} em estoque
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pdv-cart">
          <h2 className="adm-store-section-title">Carrinho</h2>
          {cart.length === 0 ? (
            <div className="adm-empty"><p>Nenhum item ainda.</p></div>
          ) : (
            <div className="pdv-cart-items">
              {cart.map((item) => (
                <div key={item.id} className="pdv-cart-item">
                  <div className="pdv-cart-item-info">
                    <span className="pdv-cart-item-name">{item.name}</span>
                    <span className="pdv-cart-item-price">{formatBRL(item.price)} un.</span>
                  </div>
                  <div className="pdv-cart-item-qty">
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>−</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                  </div>
                  <button className="adm-btn-delete" onClick={() => removeFromCart(item.id)}>🗑️</button>
                </div>
              ))}
            </div>
          )}

          <div className="pdv-payment-methods">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                className={`pdv-payment-btn ${paymentMethod === m.value ? "active" : ""}`}
                onClick={() => setPaymentMethod(m.value)}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>

          <div className="pdv-cart-total">
            <span>Total</span>
            <strong>{formatBRL(cartTotal)}</strong>
          </div>

          <button
            className="adm-btn-new-product pdv-finalize-btn"
            onClick={handleFinalizeSale}
            disabled={cart.length === 0 || submitting}
          >
            {submitting ? "Registrando..." : "✅ Finalizar venda"}
          </button>
        </div>
      </div>

      {closeModalOpen && (
        <>
          <div className="adm-modal-overlay" onClick={() => !closing && resetCloseModal()} />
          <div className="adm-modal" role="dialog" aria-modal="true">
            {closeResult ? (
              <>
                <h2 className="adm-store-section-title">Caixa fechado</h2>
                <div className="pdv-close-summary">
                  <div><span>Esperado</span><strong>{formatBRL(closeResult.expected)}</strong></div>
                  <div><span>Contado</span><strong>{formatBRL(closeResult.declared)}</strong></div>
                  <div className={closeResult.difference !== 0 ? "pdv-close-diff-mismatch" : ""}>
                    <span>Diferença</span><strong>{formatBRL(closeResult.difference)}</strong>
                  </div>
                </div>
                <button className="adm-btn-new-product" onClick={resetCloseModal}>Fechar</button>
              </>
            ) : (
              <>
                <h2 className="adm-store-section-title">Fechar caixa</h2>
                <p className="adm-store-section-desc">
                  Conte o dinheiro em caixa e informe o valor total encontrado.
                </p>
                {closeError && <div className="adm-modal-error">⚠️ {closeError}</div>}
                <div className="adm-form-field">
                  <label>Valor contado (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={declaredAmountInput}
                    onChange={(e) => setDeclaredAmountInput(e.target.value)}
                    placeholder="0,00"
                    autoFocus
                  />
                </div>
                <div className="adm-store-form-actions">
                  <button className="adm-btn-new-product" onClick={handleCloseSession} disabled={closing}>
                    {closing ? "Fechando..." : "Confirmar fechamento"}
                  </button>
                  <button className="adm-btn-back" onClick={resetCloseModal} disabled={closing}>
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
