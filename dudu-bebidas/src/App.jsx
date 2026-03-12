// ==== React imports ====
import { useEffect, useMemo, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { useLocation, useNavigate } from "react-router-dom";
// ==== Styles ====
import "./App.css";

// ==== Icons ====
import { Truck, Award, Zap, TrendingUp } from "lucide-react";

// ==== Supabase ====
import { supabase } from "./supabase/Supabaseclient";

// ==== Components ====
import Header from "./components/Header/Header";
import Banner from "./components/Banner/Banner";
import Hero from "./components/Hero/Hero";
import Benefits from "./components/Benefits/Benefits";
import ProductList from "./components/ProductList/ProductList";
import Footer from "./components/Footer/Footer";
import Cart from "./components/Cart/Cart";
import Login from "./page/login/Login";
import Checkout from "./page/Checkout/Checkout";
import Scrolltotop from "./data/scrolltotop/Scrolltotop";
import About from "./components/About/About"
// ==== Produtos (mock/data local) ====
const produtosData = [
  {
    id: 1,
    nome: "Cerveja Heineken Long Neck 330ml",
    categoria: "cerveja",
    preco: 4.99,
    precoAntigo: 6.99,
    desconto: 29,
    imagem:
      "https://images.unsplash.com/photo-1608270586620-248524c67de9?w=400",
    estoque: 45,
    promocao: true,
    destaque: true,
  },
  {
    id: 2,
    nome: "Vinho Tinto Cabernet Sauvignon",
    categoria: "vinho",
    preco: 45.9,
    precoAntigo: 65.9,
    desconto: 30,
    imagem:
      "https://images.unsplash.com/photo-1586370434639-0fe43b2d32d6?w=400",
    estoque: 12,
    promocao: true,
    destaque: false,
  },
  {
    id: 3,
    nome: "Whisky Jack Daniels 1L",
    categoria: "destilado",
    preco: 129.9,
    precoAntigo: 159.9,
    desconto: 19,
    imagem:
      "https://images.unsplash.com/photo-1527281400560-55df5b937f55?w=400",
    estoque: 8,
    promocao: false,
    destaque: true,
  },
  {
    id: 4,
    nome: "Coca-Cola 2L",
    categoria: "refrigerante",
    preco: 8.99,
    precoAntigo: 10.99,
    desconto: 18,
    imagem: "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400",
    estoque: 100,
    promocao: true,
    destaque: false,
  },
  {
    id: 5,
    nome: "Red Bull Energy Drink 250ml",
    categoria: "energetico",
    preco: 7.99,
    precoAntigo: 9.99,
    desconto: 20,
    imagem:
      "https://images.unsplash.com/photo-1622543925917-763c34f6e099?w=400",
    estoque: 50,
    promocao: false,
    destaque: false,
  },
  {
    id: 6,
    nome: "Cerveja Corona Extra 330ml",
    categoria: "cerveja",
    preco: 5.99,
    precoAntigo: 7.99,
    desconto: 25,
    imagem:
      "https://images.unsplash.com/photo-1618885472179-5e474019f2a9?w=400",
    estoque: 60,
    promocao: true,
    destaque: false,
  },
  {
    id: 7,
    nome: "Vinho Branco Chardonnay",
    categoria: "vinho",
    preco: 39.9,
    precoAntigo: 54.9,
    desconto: 27,
    imagem: "https://images.unsplash.com/photo-1560148489-2f77f8e4f48e?w=400",
    estoque: 15,
    promocao: false,
    destaque: false,
  },
  {
    id: 8,
    nome: "Vodka Absolut 1L",
    categoria: "destilado",
    preco: 89.9,
    precoAntigo: 119.9,
    desconto: 25,
    imagem:
      "https://images.unsplash.com/photo-1591367600861-1f6a762e4bb4?w=400",
    estoque: 20,
    promocao: true,
    destaque: true,
  },
];

// ==== Banners ====
const banners = [
  {
    id: 1,
    titulo: "🔥 MEGA PROMOÇÃO 🔥",
    subtitulo: "Descontos de até 50%",
    texto: "Aproveite preços imperdíveis em bebidas selecionadas",
    bg: "linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)",
    titleColor: "#000",
    textColor: "#333",
  },
  {
    id: 2,
    titulo: "⚡ OFERTA RELÂMPAGO ⚡",
    subtitulo: "Válido apenas hoje",
    texto: "Compre 2 cervejas e leve 3 - Corra!",
    bg: "linear-gradient(135deg, #dc3545 0%, #ff6b6b 100%)",
    titleColor: "#fff",
    textColor: "#fff",
  },
  {
    id: 3,
    titulo: "🚚 FRETE GRÁTIS 🚚",
    subtitulo: "Em compras acima de R$ 50",
    texto: "Receba em casa sem custo adicional",
    bg: "linear-gradient(135deg, #000 0%, #333 100%)",
    titleColor: "#ffd700",
    textColor: "#fff",
  },
];

// ==== Benefícios ====
const benefits = [
  { icon: Truck, title: "Entrega Rápida", text: "Em até 30 minutos" },
  { icon: Award, title: "Qualidade Garantida", text: "Produtos premium" },
  { icon: Zap, title: "Ofertas Relâmpago", text: "Todos os dias" },
  { icon: TrendingUp, title: "Melhores Preços", text: "Do mercado" },
];

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
      navigate("/dudu-bebidas/", { replace: true, state: {} });
    }
  }, [location.state]);
  // ==== Auth ====
  const [user, setUser] = useState(null);

  // ==== Filters ====
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("todos");

  // ==== Cart ====
  const [cartItems, setCartItems] = useState([]);

  // ==== Banner ====
  const [currentBanner, setCurrentBanner] = useState(0);

  // ==== Supabase: escuta mudanças de sessão ====
  useEffect(() => {
    // Pega sessão atual ao carregar
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Escuta login/logout em tempo real
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

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
          selectedCategory === "todos" ||
          produto.categoria === selectedCategory;

        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        if (a.promocao && !b.promocao) return -1;
        if (!a.promocao && b.promocao) return 1;
        return 0;
      });
  }, [searchTerm, selectedCategory]);

  // ==== Cart handlers ====
  const addToCart = (produto) => {
    setCartItems((prev) => {
      const itemExists = prev.find((item) => item.id === produto.id);
      if (itemExists) {
        return prev.map((item) =>
          item.id === produto.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...prev, { ...produto, quantity: 1 }];
    });
  };

  const updateQuantity = (id, quantity) => {
    if (quantity < 1) return;
    setCartItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity } : item)),
    );
  };

  const removeItem = (id) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => setCartItems([]);

  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems],
  );

  // ==== Logout ====
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // ==== Render ====
  return (
    <div style={{ minHeight: "100vh", background: "#201e0dff" }}>
      <Scrolltotop />
      <Routes>
        <Route
          path="/dudu-bebidas/"
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
                onLogout={handleLogout}
              />
              <Hero onCategorySelect={setSelectedCategory} />

              <ProductList
                filteredProducts={filteredProducts}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                addToCart={addToCart}
              />
              <About/>
              <Benefits benefits={benefits} />
              <Footer />
            </>
          }
        />
        <Route path="/checkout" element={<Checkout cartItems={cartItems} />} />
      </Routes>

      <Cart
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        cartItems={cartItems}
        updateQuantity={updateQuantity}
        removeItem={removeItem}
        clearCart={clearCart}
      />

      <Login isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}
