// import components
import ProductCard from "../ProductCard/ProductCard";
// import styles
import "./Products.css";
import { useState } from "react";

export default function ProductList({
  filteredProducts,
  selectedCategory,
  setSelectedCategory,
  addToCart,
}) {
  const [visibleCount, setVisibleCount] = useState(12); // Começa com 12 produtos
  const productsCount = filteredProducts.length;
  const hasProducts = filteredProducts.length > 0;
  
  // Produtos visíveis atualmente
  const visibleProducts = filteredProducts.slice(0, visibleCount);
  const hasMore = visibleCount < productsCount;
  const hasVisibleExcess = visibleCount > 12; // Para mostrar botão "Ver Menos"

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    setVisibleCount(12); // Resetar ao mudar categoria
  };

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 12); // Carrega mais 12 produtos
  };

  const handleShowLess = () => {
    setVisibleCount(12); // Volta para 12 produtos
    // Scroll suave para o topo da seção de produtos
    const produtosSection = document.getElementById('produtos');
    if (produtosSection) {
      produtosSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const categories = [
    { id: "todos",        label: "Todos",         icon: "bi-grid-fill" },
    { id: "cerveja",      label: "Cervejas",      icon: "bi-cup-straw" },
    { id: "vinho",        label: "Vinhos",        icon: "bi-cup" },
    { id: "destilado",    label: "Destilados",    icon: "bi-droplet-fill" },
    { id: "refrigerante", label: "Refrigerantes", icon: "bi-cup-hot-fill" },
    { id: "energetico",   label: "Energéticos",   icon: "bi-lightning-charge-fill" },
    { id: "outros",       label: "Outros",        icon: "bi-bag" },
  ];

  return (
    <section id="produtos" className="py-5">
      <div className="container">

        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-5 flex-wrap gap-3">
          <div>
            <h2 className="section-title fw-bold">Nossos Produtos</h2>
            {!hasProducts && (
              <p className="text-muted mt-2">Nenhum produto encontrado</p>
            )}
          </div>
          <div className="text-end">
            <span className="badge bg-dark">
              {productsCount} produtos disponíveis
            </span>
          </div>
        </div>

        {/* Category Filters */}
        <div className="filter-container">
          <div className="filter-scroll-wrapper">
            <div className="overflow-x-auto">
              {categories.map(({ id, icon, label }) => (
                <button
                  key={id}
                  onClick={() => handleCategorySelect(id)}
                  className={`filter-btn ${selectedCategory === id ? "active" : ""}`}
                >
                  <i className={`bi ${icon}`}></i>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Products Grid */}
        <div className="row row-cols-2 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 row-cols-xl-5 g-3 g-md-4">
          {hasProducts ? (
            visibleProducts.map((produto, index) => (
              <ProductCard
                key={produto.id}
                produto={produto}
                index={index}
                addToCart={addToCart}
              />
            ))
          ) : (
            <div className="col-12 text-center py-5">
              <div className="p-5">
                <i className="bi bi-search empty-state-icon"></i>
                <h4 className="mt-4 mb-2">Nenhum produto encontrado</h4>
                <p className="text-muted">
                  Tente buscar por outro termo ou categoria
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Botões de controle */}
        {hasProducts && (
          <div className="text-center mt-5 pt-3">
            {/* Botão Ver Mais */}
            {hasMore && (
              <button 
                onClick={handleLoadMore}
                className="btn-ver-mais"
              >
                <i className="bi bi-plus-circle me-2"></i>
                Ver Mais Produtos
                <span className="ms-2 badge">
                  +{Math.min(12, productsCount - visibleCount)} de {productsCount - visibleCount} restantes
                </span>
              </button>
            )}

            {/* Botão Ver Menos - aparece apenas se tiver mais de 12 produtos visíveis */}
            {hasVisibleExcess && (
              <button 
                onClick={handleShowLess}
                className="btn-ver-menos ms-3"
              >
                <i className="bi bi-dash-circle me-2"></i>
                Ver Menos Produtos
              </button>
            )}
          </div>
        )}

        {/* Mensagem quando todos os produtos estão visíveis */}
        {hasProducts && !hasMore && visibleCount > 12 && (
          <div className="text-center mt-5 pt-3">
            <p className="text-muted">
              <i className="bi bi-check-circle-fill me-2 text-success"></i>
              Você já visualizou todos os {productsCount} produtos
            </p>
          </div>
        )}

      </div>
    </section>
  );
}