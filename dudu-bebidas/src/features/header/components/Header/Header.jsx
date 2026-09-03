// ─────────────────────────────────────────────────────────
// IMPORTAÇÕES
// ─────────────────────────────────────────────────────────
import { useNavigate } from "react-router-dom"; // Hook para navegação entre páginas
import { ShoppingCart, User, Search, LogOut } from "lucide-react"; // Ícones visuais
import "./Header.css"; // Estilos específicos do Header
import { useStoreStatus } from "../../../../shared/context/useStoreStatus"; // Hook para status da loja (aberta/fechada)
import { useProductCategories } from "../../../../shared/hooks/useProductCategories"; // Hook para obter categorias de produtos

// ─────────────────────────────────────────────────────────
// COMPONENTE HEADER
// ─────────────────────────────────────────────────────────
// Exibe a barra de navegação superior com logo, busca, autenticação e carrinho
export default function Header({
  // ✓ Props recebidas do componente pai
  searchTerm, // Termo de busca atual
  setSearchTerm, // Função para atualizar o termo de busca
  cartCount, // Número de itens no carrinho
  menuOpen, // Estado do menu mobile (aberto/fechado)
  setMenuOpen, // Função para alterar estado do menu mobile
  scrolled, // Boolean indicando se a página foi scrollada
  onCartClick, // Callback quando clica no carrinho
  onLoginClick, // Callback quando clica para fazer login
  onCategoryClick, // Callback quando clica em uma categoria
  user, // Dados do usuário autenticado
  onLogout, // Callback quando faz logout
  isAdmin, // Boolean indicando se o usuário é admin
}) {
  // logo loja
  const logo_dudu = "https://res.cloudinary.com/dfcsficmg/image/upload/v1786649996/logo_dudu-bebidas.webp"

  // ─────────────────────────────────────────────────────────
  // HOOKS
  // ─────────────────────────────────────────────────────────
  const navigate = useNavigate(); // Hook para navegação entre rotas

  // ─────────────────────────────────────────────────────────
  // CATEGORIAS DINÂMICAS
  // ─────────────────────────────────────────────────────────
  // Obtém categorias do banco de dados em vez de lista fixa
  // Isso evita que o filtro quebre se categorias forem renomeadas no admin
  // Filtra a categoria "todos" e mapeia os dados para formato esperado
  const { categories: allCategories } = useProductCategories();
  const categories = allCategories
    .filter((c) => c.id !== "todos")
    .map((c) => ({ name: c.label, icon: c.icon, categoryId: c.id }));

  // ─────────────────────────────────────────────────────────
  // FUNÇÃO: Ao clicar em categoria
  // ─────────────────────────────────────────────────────────
  // 1. Chama o callback do componente pai (para filtrar produtos)
  // 2. Aguarda um pouco e faz scroll suave até a seção de produtos
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

  // ─────────────────────────────────────────────────────────
  // DADOS DO USUÁRIO E STATUS DA LOJA
  // ─────────────────────────────────────────────────────────
  // Extrai primeiro nome do usuário (da metadata ou do email)
  const firstName = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(" ")[0]
    : (user?.email?.split("@")[0] ?? "");
  // Obtém status da loja (aberta/fechada com mensagem)
  const storeStatus = useStoreStatus();

  // ─────────────────────────────────────────────────────────
  // RENDERIZAÇÃO DO HEADER
  // ─────────────────────────────────────────────────────────
  return (
    <header
      className={`sticky-top navbar-custom ${scrolled ? "scrolled" : ""}`}
    >
      {/* BANNER DE LOJA FECHADA */}
      {/* Exibe mensagem se a loja estiver fechada */}
      {!storeStatus.open && (
        <div className="site-closed-banner text-black text-center fw-bold bg-warning p-1">
          {storeStatus.message}
        </div>
      )}
      <nav className="navbar navbar-dark">
        {/* ── BARRA PRINCIPAL ── */}
        <div
          className="container-fluid px-3 px-lg-4"
          style={{ flexWrap: "nowrap" }}
        >
          {/* LOGO E MARCA */}
          {/* Exibe logo + nome "Dudu Bebidas" */}
          <a
            href="#"
            className="navbar-brand logo d-flex align-items-center gap-2"
            style={{ flexShrink: 0 }}
          >
            <div className="logo-image-wrapper">
              <img src={logo_dudu} alt="Dudu Bebidas Logo" className="logo-image" />
            </div>
            <div className="brand-text">
              Dudu <span>Bebidas</span>
            </div>
          </a>

          {/* BUSCA - DESKTOP */}
          {/* Campo de busca visível apenas em telas grandes */}
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

          {/* AÇÕES - BUTTONS */}
          {/* Admin, Autenticação (Login/Logout), Carrinho e Menu Mobile */}
          <div
            className="d-flex align-items-center gap-2"
            style={{ flexShrink: 0 }}
          >
            {/* BOTÃO ADMIN */}
            {/* Exibe botão de acesso à área admin (visível apenas para admins) */}
            {isAdmin && (
              <button onClick={() => navigate("/admin")} className="btn-admin">
                <span>Admin</span> ⚙️
              </button>
            )}

            {/* SEÇÃO DE AUTENTICAÇÃO - DESKTOP/TABLET */}
            {/* Oculto em mobile, aparece apenas em lg+ */}
            <div className="d-none d-lg-flex align-items-center gap-2">
              {user ? (
                /* ── USUÁRIO LOGADO ── */
                /* Avatar com inicial do nome + nome + botão sair */
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
                /* ── USUÁRIO DESLOGADO ── */
                /* Botão para fazer login */
                <button
                  onClick={onLoginClick}
                  className="user-btn d-flex align-items-center gap-2"
                  title="Entrar"
                >
                  <User size={20} />
                  <span className="d-none d-lg-inline">Entrar</span>
                </button>
              )}
            </div>

            {/* BOTÃO CARRINHO */}
            {/* Exibe ícone do carrinho com badge mostrando quantidade de itens */}
            <button
              className="user-btn position-relative d-flex align-items-center gap-2"
              onClick={onCartClick}
              title="Carrinho"
            >
              <ShoppingCart size={20} />
              {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
              <span className="d-none d-lg-inline">Carrinho</span>
            </button>

            {/* TOGGLER DO MENU MOBILE */}
            {/* Ícone de hambúrguer visível apenas em telas pequenas (mobile) */}
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

        {/* BARRA DE CATEGORIAS - DESKTOP */}
        {/* Menu de categorias visível apenas em telas grandes, com ícones */}
        <div className="categories-bar d-none d-lg-block w-100">
          <div className="container-fluid px-3 px-lg-4">
            <div className="categories-wrapper">
              {categories.map((category) => (
                <button
                  key={category.categoryId}
                  onClick={() => handleCategoryClick(category.categoryId)}
                  className="category-item"
                >
                  <i
                    className={`bi ${category.icon}`}
                    style={{ fontSize: 18 }}
                  />
                  <span>{category.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* BUSCA - MOBILE */}
        {/* Campo de busca visível apenas em telas pequenas, com auto-scroll para produtos */}
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

      {/* MENU MOBILE */}
      {/* Menu dropdown que aparece quando hamburger é clicado, com navegação e categorias */}
      {menuOpen && (
        <div
          className="bg-black border-top py-3 d-lg-none"
          style={{ borderColor: "#333 !important" }}
        >
          <div className="container-fluid px-3">
            {/* Links de navegação principal */}
            {/* Início - Vai para seção Hero */}
            <a
              href="#hero"
              className="d-block text-white text-decoration-none py-2 px-3 rounded mb-1"
              onClick={() => setMenuOpen(false)}
            >
              <i className="bi bi-house-door-fill me-2"></i>Início
            </a>
            {/* Bebidas - Vai para seção de produtos */}
            <a
              href="#produtos"
              className="d-block text-white text-decoration-none py-2 px-3 rounded mb-1"
              onClick={() => setMenuOpen(false)}
            >
              <i className="bi bi-grid-fill me-2"></i>Bebidas
            </a>

            {/* CATEGORIAS NO MENU MOBILE */}
            {/* Lista de categorias dinâmicas com ícones, clicáveis para filtrar */}
            {categories.map((category) => (
              <button
                key={category.categoryId}
                onClick={() => {
                  handleCategoryClick(category.categoryId);
                  setMenuOpen(false);
                }}
                className="d-flex align-items-center gap-2 text-white text-decoration-none py-2 px-3 rounded mb-1 w-100 text-start border-0 bg-transparent"
                style={{ fontSize: "14px" }}
              >
                <i className={`bi ${category.icon}`} style={{ fontSize: 16 }} />
                {category.name}
              </button>
            ))}

            {/* LINK DE CONTATO */}
            {/* Vai para seção de contato ao clicar */}
            <a
              href="#contato"
              className="d-block text-white text-decoration-none py-2 px-3 rounded mb-1"
              onClick={() => setMenuOpen(false)}
            >
              <i className="bi bi-envelope-fill me-2"></i>Contato
            </a>

            {/* DIVISOR */}
            <hr
              className="my-2"
              style={{ borderColor: "rgba(255,255,255,0.1)" }}
            />

            {/* SEÇÃO DE AUTENTICAÇÃO - MOBILE */}
            {/* Exibida apenas no menu mobile */}
            {user ? (
              /* ── USUÁRIO LOGADO ── */
              <>
                <div className="d-flex align-items-center gap-2 text-white py-2 px-3 rounded mb-1">
                  <div
                    className="user-avatar"
                    style={{ width: "30px", height: "30px" }}
                  >
                    {firstName.charAt(0).toUpperCase()}
                  </div>
                  <span>{firstName}</span>
                </div>
                <button
                  onClick={() => {
                    onLogout();
                    setMenuOpen(false);
                  }}
                  className="d-flex align-items-center gap-2 text-white text-decoration-none py-2 px-3 rounded w-100 text-start border-0 bg-transparent"
                  style={{ fontSize: "14px", color: "#ff6b6b !important" }}
                >
                  <LogOut size={16} />
                  Sair
                </button>
              </>
            ) : (
              /* ── USUÁRIO DESLOGADO ── */
              <button
                onClick={() => {
                  onLoginClick();
                  setMenuOpen(false);
                }}
                className="d-flex align-items-center gap-2 text-white text-decoration-none py-2 px-3 rounded w-100 text-start border-0 bg-transparent"
                style={{ fontSize: "14px" }}
              >
                <User size={16} />
                Entrar
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
