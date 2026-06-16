// ==== React imports ====
import { useEffect, useMemo, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { useLocation, useNavigate } from "react-router-dom";
// ==== Styles ====
import "./App.css";
// ==== Supabase ====
import { supabase } from "./supabase/Supabaseclient";
// ==== Data ====
import { useProducts } from "./hooks/useProducts";
import { useCart }     from "./hooks/useCart";
import banners  from "./data/banners";
import benefits from "./data/benefits";
// ==== Components ====
import Header        from "./components/Header/Header";
import Banner        from "./components/Banner/Banner";
import Hero          from "./components/Hero/Hero";
import Benefits      from "./components/Benefits/Benefits";
import ProductList   from "./components/ProductList/ProductList";
import Footer        from "./components/Footer/Footer";
import Cart          from "./components/Cart/Cart";
import Login         from "./page/login/login";
import Checkout      from "./page/Checkout/Checkout";
import Scrolltotop   from "./data/scrolltotop/Scrolltotop";
import About         from "./components/About/About";
import Confirm       from "./page/Confirm/Confirm";
import Admin         from "./page/admin/Admin";
import PrivacyPolicy from "./page/privacy-politcy/PrivacyPoclicy";
import TermsOfService from "./page/terms-service/TermsService";
import CookieConsent from "./components/CookieConsent/CookieConsent";

export default function DuduBebidas() {
  // ==== UI States ====
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [cartOpen,   setCartOpen]   = useState(false);
  const [loginOpen,  setLoginOpen]  = useState(false);
  const [scrolled,   setScrolled]   = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

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

  useEffect(() => {
    const fetchAdmin = async () => {
      if (!user) { setIsAdmin(false); return; }
      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();
      setIsAdmin(!error && data?.is_admin ? true : false);
    };
    fetchAdmin();
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
        <Route path="/admin"           element={<Admin user={user} isAdmin={isAdmin} />} />
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
      <CookieConsent />
    </div>
  );
}