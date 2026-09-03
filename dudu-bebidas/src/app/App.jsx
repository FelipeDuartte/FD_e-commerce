// ==== React imports ====
import { useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { useLocation, useNavigate } from "react-router-dom";
// ==== Styles ====
import "./App.css";
// ==== Supabase ====
import { supabase, getCurrentStoreId } from "../shared/supabase/Supabaseclient";
// ==== Data ====
import { useProducts } from "../features/catalog/hooks/useProducts";
import { useCart }     from "../features/cart/hooks/useCart";
import banners  from "../features/catalog/data/banners";
import benefits from "../features/catalog/data/benefits";
// ==== Components ====
import Header        from "../features/header/components/Header/Header";
import Banner        from "../features/catalog/components/Banner/Banner";
import Hero          from "../features/catalog/components/Hero/Hero";
import Benefits      from "../features/catalog/components/Benefits/Benefits";
import ProductList   from "../features/catalog/components/ProductList/ProductList";
import Footer        from "../shared/components/Footer/Footer";
import Cart          from "../features/cart/components/Cart/Cart";
import AgeGate from "../shared/components/AgeGate/AgeGate";
import { hasAcceptedAgeGate } from "../shared/components/AgeGate/ageGateStorage";
import Login         from "../features/auth/login";
import Checkout      from "../features/checkout/Checkout";
import Scrolltotop   from "../shared/components/Scrolltotop";
import About         from "../features/catalog/components/About/About";
import Confirm       from "../features/confirm/Confirm";
import LastOrderBanner from "../shared/components/LastOrderBanner/LastOrderBanner";
// Carregado sob demanda: só quem realmente navega pra /admin baixa esse
// código (painel inteiro + serviços + CSS). Antes era import estático, e
// todo visitante do site — inclusive quem nunca abre o admin — baixava
// esse pedaço junto no carregamento inicial.
const Admin = lazy(() => import("../page/admin/Admin"));
import PrivacyPolicy from "../features/legal/privacy-policy/PrivacyPolicy";
import TermsOfService from "../features/legal/terms-service/TermsService";
import { StoreStatusProvider } from "../shared/context/StoreStatusContext";

// Tela leve enquanto o chunk do painel admin baixa (só acontece na
// primeira vez que alguém acessa /admin — depois fica em cache do navegador).
function AdminLoadingFallback() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        background: "#0d0d0d",
      }}
    >
      <div
        style={{
          width: "44px",
          height: "44px",
          border: "4px solid rgba(255, 215, 0, 0.15)",
          borderTopColor: "#ffd700",
          borderRadius: "50%",
          animation: "admin-loading-spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes admin-loading-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function DuduBebidas() {
  // ==== UI States ====
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [cartOpen,   setCartOpen]   = useState(false);
  const [loginOpen,  setLoginOpen]  = useState(false);
  const [scrolled,   setScrolled]   = useState(false);
  const [ageGateAccepted, setAgeGateAccepted] = useState(() => hasAcceptedAgeGate());

  const location = useLocation();
  const navigate = useNavigate();
  const isLegalPage = ["/privacy-policy", "/terms-service"].includes(location.pathname);

  useEffect(() => {
    if (location.state?.openCart) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCartOpen(true);
      navigate("/", { replace: true, state: {} });
    }
    if (location.state?.openLogin) {
      setLoginOpen(true);
      navigate("/", { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  // ==== Auth ====
  const [user,    setUser]    = useState(null);
  const [isAdmin, setIsAdmin] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    );
    return () => subscription.unsubscribe();
  }, []);

  const lastCheckedUid = useRef(null);

  useEffect(() => {
    if (!user) {
      lastCheckedUid.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsAdmin(false);
      return;
    }
    if (user.id === lastCheckedUid.current) return;
    lastCheckedUid.current = user.id;

    supabase
      .from("profiles")
      .select("is_admin, store_id")
      .eq("id", user.id)
      .single()
      .then(({ data, error }) => {
        // MULTI-LOJA: is_admin sozinho não basta — o auth.users é compartilhado
        // entre TODAS as lojas (mesmo projeto Supabase). Um admin da Loja B
        // logado no site da Loja A não pode ver o painel admin da Loja A.
        const admin =
          !error &&
          data?.is_admin === true &&
          data?.store_id === getCurrentStoreId();
        setIsAdmin(admin);
      });
  }, [user]);

  // ==== Produtos ====
  const {
    products: produtosData,
    loading: produtosLoading,
    error: produtosError,
  } = useProducts();

  // ==== Carrinho ====
  const { cartItems, cartCount, addToCart, updateQuantity, removeItem, clearCart } = useCart();

  // ==== Filters ====
  const [searchTerm,       setSearchTerm]       = useState("");
  const [selectedCategory, setSelectedCategory] = useState("todos");

  // ==== Banner carousel ====
  const [currentBanner, setCurrentBanner] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // ==== Produtos filtrados ====
  const filteredProducts = useMemo(() => {
    return produtosData
      .filter((produto) => {
        const matchesSearch   = produto.nome.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === "todos" || produto.categoria === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        if (a.promocao && !b.promocao) return -1;
        if (!a.promocao && b.promocao) return 1;
        return 0;
      });
  }, [produtosData, searchTerm, selectedCategory]);

  // ==== Logout ====
  const handleLogout = async () => { await supabase.auth.signOut(); };

  // ==== Render ====
  return (
    <StoreStatusProvider>
    <div style={{ minHeight: "100vh", background: "#1a1a1a" }}>
      <Scrolltotop />
      <Routes>
        <Route
          path="/"
          element={
            <>
              <Banner
                banners={banners}
                currentBanner={currentBanner}
                setCurrentBanner={setCurrentBanner}
              />
              <Header
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                cartCount={cartCount}
                menuOpen={menuOpen}
                setMenuOpen={setMenuOpen}
                scrolled={scrolled}
                onCartClick={() => setCartOpen(true)}
                onLoginClick={() => setLoginOpen(true)}
                onCategoryClick={setSelectedCategory}
                user={user}
                isAdmin={isAdmin}
                onLogout={handleLogout}
              />
              <Hero onCategorySelect={setSelectedCategory} />

              {produtosLoading ? (
                <div style={{ textAlign: "center", padding: "4rem" }}>
                  Carregando produtos...
                </div>
              ) : produtosError ? (
                <div style={{ textAlign: "center", padding: "4rem" }}>
                  {produtosError}
                </div>
              ) : (
                <ProductList
                  filteredProducts={filteredProducts}
                  selectedCategory={selectedCategory}
                  setSelectedCategory={setSelectedCategory}
                  addToCart={addToCart}
                />
              )}

              <About />
              <Benefits benefits={benefits} />
              <Footer />
            </>
          }
        />
        <Route path="/privacy-policy"  element={<PrivacyPolicy />} />
        <Route path="/terms-service"   element={<TermsOfService />} />
        <Route path="/checkout"        element={<Checkout user={user} clearCart={clearCart} />} />
        <Route path="/confirmacao"     element={<Confirm user={user} />} />
        <Route
          path="/admin"
          element={
            <Suspense fallback={<AdminLoadingFallback />}>
              <Admin user={user} isAdmin={isAdmin} />
            </Suspense>
          }
        />
      </Routes>

      <Cart
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        cartItems={cartItems}
        updateQuantity={updateQuantity}
        removeItem={removeItem}
        clearCart={clearCart}
        user={user}
      />

      <Login isOpen={loginOpen} onClose={() => setLoginOpen(false)} />

      <LastOrderBanner />

      {!ageGateAccepted && !isLegalPage && (
        <AgeGate onAccept={() => setAgeGateAccepted(true)} />
      )}
    </div>
    </StoreStatusProvider>
  );
}