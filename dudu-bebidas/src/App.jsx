// ==== React imports ====
import { useEffect, useMemo, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { useLocation, useNavigate } from "react-router-dom";

// ==== Styles ====
import "./App.css";

// ==== Supabase ====
import { supabase } from "./supabase/Supabaseclient";

// ==== Data ====
// import produtosData from "./data/Poducts"; // ← REMOVER ESTA LINHA
import { useProducts } from "./hooks/useProducts"; // ← ADICIONAR
import banners from "./data/banners";
import benefits from "./data/benefits";

// ==== Components ====
import Header from "./components/Header/Header";
import Banner from "./components/Banner/Banner";
import Hero from "./components/Hero/Hero";
import Benefits from "./components/Benefits/Benefits";
import ProductList from "./components/ProductList/ProductList";
import Footer from "./components/Footer/Footer";
import Cart from "./components/Cart/Cart";
import Login from "./page/login/login";
import Checkout from "./page/Checkout/Checkout";
import Scrolltotop from "./data/scrolltotop/Scrolltotop";
import About from "./components/About/About";
import Confirm from "./page/Confirm/Confirm";
import Admin from "./page/admin/Admin";
import PrivacyPolicy from "./page/privacy-politcy/PrivacyPoclicy";
import TermsOfService from "./page/terms-service/TermsService";

export default function DuduBebidas() {
  // ==== UI States ====
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.state?.openCart) {
      setCartOpen(true);
      navigate("/", { replace: true, state: {} });
    }
    if (location.state?.openLogin) {
      setLoginOpen(true);
      navigate("/", { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  // ==== Auth ====
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(null);

  useEffect(() => {
    const fetchAdmin = async () => {
      if (!user) { setIsAdmin(false); return; }
      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();
      if (!error && data?.is_admin) setIsAdmin(true);
      else setIsAdmin(false);
    };
    fetchAdmin();
  }, [user]);

  // ==== Produtos do Supabase ← ALTERADO ====
  const { products: produtosData, loading: produtosLoading } = useProducts();

  // ==== Filters ====
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("todos");

  // ==== Cart ====
  const [cartItems, setCartItems] = useState([]);

  // ==== Banner ====
  const [currentBanner, setCurrentBanner] = useState(0);

  // ==== Supabase: escuta mudanças de sessão ====
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => { setUser(session?.user ?? null); }
    );
    return () => subscription.unsubscribe();
  }, []);

  // ==== Scroll effect ====
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ==== Banner carousel ====
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // ==== Produtos filtrados + ordenados ====
  const filteredProducts = useMemo(() => {
    return produtosData
      .filter((produto) => {
        const matchesSearch = produto.nome
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
        const matchesCategory =
          selectedCategory === "todos" || produto.categoria === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        if (a.promocao && !b.promocao) return -1;
        if (!a.promocao && b.promocao) return 1;
        return 0;
      });
  }, [produtosData, searchTerm, selectedCategory]);

  // ==== Cart handlers ====
  const addToCart = (produto) => {
    setCartItems((prev) => {
      const itemExists = prev.find((item) => item.id === produto.id);
      if (itemExists) {
        return prev.map((item) =>
          item.id === produto.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...produto, quantity: 1 }];
    });
  };

  const updateQuantity = (id, quantity) => {
    if (quantity < 1) return;
    setCartItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item))
    );
  };

  const removeItem = (id) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => setCartItems([]);

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  // ==== Logout ====
  const handleLogout = async () => { await supabase.auth.signOut(); };

  // ==== Render ====
  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>
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

              {/* Mostra loading enquanto busca produtos */}
              {produtosLoading ? (
                <div style={{ textAlign: "center", padding: "4rem" }}>
                  Carregando produtos...
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
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-service" element={<TermsOfService />} />
        <Route path="/checkout" element={<Checkout user={user} />} />
        <Route path="/confirmacao" element={<Confirm user={user} />} />
        <Route path="/admin" element={<Admin user={user} isAdmin={isAdmin} />} />
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
    </div>
  );
}