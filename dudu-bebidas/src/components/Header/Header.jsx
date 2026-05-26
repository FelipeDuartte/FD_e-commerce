import logo from "../../assets/logo_dudu-bebidas.png";
import { useNavigate } from "react-router-dom";
import {
  ShoppingCart,
  User,
  Search,
  Wine,
  Beer,
  Droplets,
  CupSoda,
  Zap,
  LogOut,
} from "lucide-react";
import "./Header.css";
import { isMonday } from "../../utils/storeHours";

export default function Header({
  searchTerm,
  setSearchTerm,
  cartCount,
  menuOpen,
  setMenuOpen,
  scrolled,
  onCartClick,
  onLoginClick,
  onCategoryClick,
  user,
  onLogout,
  isAdmin,
}) {
  const navigate = useNavigate();
  const categories = [
    { name: "Vinhos", icon: Wine, categoryId: "vinho" },
    { name: "Cervejas", icon: Beer, categoryId: "cerveja" },
    { name: "Destilados", icon: Droplets, categoryId: "destilado" },
    { name: "Refri / Sucos", icon: CupSoda, categoryId: "refrigerante" },
    { name: "Energéticos", icon: Zap, categoryId: "energetico" },
  ];

  const handleCategoryClick = (categoryId) => {
    if (onCategoryClick) {
      onCategoryClick(categoryId);
    }
    setTimeout(() => {
      const produtosSection = document.getElementById("produtos");
      if (produtosSection) {
        produtosSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 50);
  };

  const firstName = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(" ")[0]
    : (user?.email?.split("@")[0] ?? "");

  return (
    <header
      className={`sticky-top navbar-custom ${scrolled ? "scrolled" : ""}`}
    >
      {isMonday() && (
        <div className="site-closed-banner">
          Hoje é segunda — a loja está fechada. Não é possível finalizar compras
          hoje.
        </div>
      )}
      <nav className="navbar navbar-dark">
        {/* ── BARRA PRINCIPAL ── */}
        <div
          className="container-fluid px-3 px-lg-4"
          style={{ flexWrap: "nowrap" }}
        >
          {/* Logo */}
          <a
            href="#"
            className="navbar-brand logo d-flex align-items-center gap-2"
            style={{ flexShrink: 0 }}
          >
            <div className="logo-image-wrapper">
              <img src={logo} alt="Dudu Bebidas Logo" className="logo-image" />
            </div>
            <div className="brand-text">
              Dudu <span>Bebidas</span>
            </div>
          </a>

          {/* Search — Desktop */}
          <div
            className="d-none d-lg-flex flex-grow-1 mx-4"
            style={{ maxWidth: "500px" }}
          >
            <div className="search-box w-100">
              <Search className="search-icon" size={22} />
              <input
                type="search"
                placeholder="Buscar bebidas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-control border-0"
                style={{
                  background: "transparent",
                  outline: "none",
                  boxShadow: "none",
                  fontSize: "15px",
                  color: "#fff",
                }}
              />
            </div>
          </div>

          {/* Actions */}
          <div
            className="d-flex align-items-center gap-2"
            style={{ flexShrink: 0 }}
          >
            {isAdmin && (
              <button onClick={() => navigate("/admin")} className="btn-admin">
                <span>Admin</span> ⚙️
              </button>
            )}

            {user ? (
              /* ── LOGADO ── */
              <>
                <div className="user-avatar">
                  {firstName.charAt(0).toUpperCase()}
                </div>
                <span className="user-name d-none d-lg-inline">
                  {firstName}
                </span>
                <button
                  onClick={onLogout}
                  className="user-btn logout-btn d-flex align-items-center gap-1"
                  title="Sair"
                >
                  <LogOut size={18} />
                  <span className="d-none d-lg-inline">Sair</span>
                </button>
              </>
            ) : (
              /* ── DESLOGADO ── */
              <button
                onClick={onLoginClick}
                className="user-btn d-flex align-items-center gap-2"
                title="Entrar"
              >
                <User size={20} />
                <span className="d-none d-lg-inline">Entrar</span>
              </button>
            )}

            {/* Carrinho */}
            <button
              className="user-btn position-relative d-flex align-items-center gap-2"
              onClick={onCartClick}
              title="Carrinho"
            >
              <ShoppingCart size={20} />
              {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
              <span className="d-none d-lg-inline">Carrinho</span>
            </button>

            {/* Toggler mobile */}
            <button
              className="navbar-toggler d-lg-none border-0 shadow-none"
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
            >
              <span className="navbar-toggler-icon"></span>
            </button>
          </div>
        </div>

        {/* ── CATEGORIES BAR — Desktop ── */}
        <div className="categories-bar d-none d-lg-block w-100">
          <div className="container-fluid px-3 px-lg-4">
            <div className="categories-wrapper">
              {categories.map((category, index) => {
                const IconComponent = category.icon;
                return (
                  <button
                    key={index}
                    onClick={() => handleCategoryClick(category.categoryId)}
                    className="category-item"
                  >
                    <IconComponent size={18} />
                    <span>{category.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── SEARCH — Mobile ── */}
        <div className="container-fluid d-lg-none mt-2 px-3">
          <div className="search-box w-100">
            <Search className="search-icon" size={20} />
            <input
              type="search"
              placeholder="Buscar bebidas..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                document
                  .getElementById("produtos")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="form-control border-0 text-white"
              style={{
                background: "transparent",
                outline: "none",
                boxShadow: "none",
              }}
            />
          </div>
        </div>
      </nav>

      {/* ── MOBILE MENU ── */}
      {menuOpen && (
        <div
          className="bg-black border-top py-3 d-lg-none"
          style={{ borderColor: "#333 !important" }}
        >
          <div className="container-fluid px-3">
            <a
              href="#hero"
              className="d-block text-white text-decoration-none py-2 px-3 rounded mb-1"
              onClick={() => setMenuOpen(false)}
            >
              <i className="bi bi-house-door-fill me-2"></i>Início
            </a>
            <a
              href="#produtos"
              className="d-block text-white text-decoration-none py-2 px-3 rounded mb-1"
              onClick={() => setMenuOpen(false)}
            >
              <i className="bi bi-grid-fill me-2"></i>Bebidas
            </a>

            {/* Categorias no mobile menu */}
            {categories.map((category, index) => {
              const IconComponent = category.icon;
              return (
                <button
                  key={index}
                  onClick={() => {
                    handleCategoryClick(category.categoryId);
                    setMenuOpen(false);
                  }}
                  className="d-flex align-items-center gap-2 text-white text-decoration-none py-2 px-3 rounded mb-1 w-100 text-start border-0 bg-transparent"
                  style={{ fontSize: "14px" }}
                >
                  <IconComponent size={16} />
                  {category.name}
                </button>
              );
            })}

            <a
              href="#contato"
              className="d-block text-white text-decoration-none py-2 px-3 rounded mb-1"
              onClick={() => setMenuOpen(false)}
            >
              <i className="bi bi-envelope-fill me-2"></i>Contato
            </a>

            {user && (
              <button
                onClick={() => {
                  onLogout();
                  setMenuOpen(false);
                }}
                className="d-flex align-items-center gap-2 text-white text-decoration-none py-2 px-3 rounded mt-2 w-100 text-start border-0 bg-transparent"
                style={{ fontSize: "14px", color: "#ff6b6b !important" }}
              >
                <LogOut size={16} />
                Sair ({firstName})
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
