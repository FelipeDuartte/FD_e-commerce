import ProductCard from "../ProductCard/ProductCard";
import "./Products.css";
import { useState } from "react";

const PAGE_SIZE = 12;

const CATEGORIES = [
  { id: "todos",        label: "Todos",         icon: "bi-grid-fill" },
  { id: "cerveja",      label: "Cervejas",      icon: "bi-cup-straw" },
  { id: "vinho",        label: "Vinhos",        icon: "bi-cup" },
  { id: "destilado",    label: "Destilados",    icon: "bi-droplet-fill" },
  { id: "refrigerante", label: "Refri / Sucos", icon: "bi-cup-straw" },
  { id: "energetico",   label: "Energéticos",   icon: "bi-lightning-charge-fill" },
  { id: "outros",       label: "Outros",        icon: "bi-bag" },
];

export default function ProductList({
  filteredProducts,
  selectedCategory,
  setSelectedCategory,
  addToCart,
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const productsCount   = filteredProducts.length;
  const hasProducts     = productsCount > 0;
  const visibleProducts = filteredProducts.slice(0, visibleCount);
  const hasMore         = visibleCount < productsCount;
  const hasVisibleExcess = visibleCount > PAGE_SIZE;

  const handleCategorySelect = (id) => {
    setSelectedCategory(id);
    setVisibleCount(PAGE_SIZE);
  };

  const handleLoadMore = () => setVisibleCount((prev) => prev + PAGE_SIZE);

  const handleShowLess = () => {
    setVisibleCount(PAGE_SIZE);
    setTimeout(() => {
      const el = document.getElementById("produtos");
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" });
    }, 50);
  };

  return (
    <section id="produtos" className="py-5">
      <div className="container">

        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-5 flex-wrap gap-3">
          <div>
            <h2 className="section-title fw-bold">Nossos Produtos</h2>
            {!hasProducts && <p className="text-muted mt-2">Nenhum produto encontrado</p>}
          </div>
          <span className="badge bg-dark">{productsCount} produtos disponíveis</span>
        </div>

        {/* Filtros */}
        <div className="filter-container">
          <div className="filter-scroll-wrapper">
            <div className="overflow-x-auto">
              {CATEGORIES.map(({ id, icon, label }) => (
                <button
                  key={id}
                  onClick={() => handleCategorySelect(id)}
                  className={`filter-btn${selectedCategory === id ? " active" : ""}`}
                >
                  <i className={`bi ${icon}`} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="row row-cols-2 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 row-cols-xl-5 g-3 g-md-4">
          {hasProducts ? (
            visibleProducts.map((produto, index) => (
              <ProductCard key={produto.id} produto={produto} index={index} addToCart={addToCart} />
            ))
          ) : (
            <div className="col-12 text-center py-5">
              <div className="p-5">
                <i className="bi bi-search empty-state-icon" />
                <h4 className="mt-4 mb-2">Nenhum produto encontrado</h4>
                <p className="text-muted">Tente buscar por outro termo ou categoria</p>
              </div>
            </div>
          )}
        </div>

        {/* Controles */}
        {hasProducts && (hasMore || hasVisibleExcess) && (
          <div className="produtos-controle-btns">
            {hasMore && (
              <button onClick={handleLoadMore} className="btn-ver-mais">
                <i className="bi bi-plus-circle me-2" />
                Ver Mais Produtos
                <span className="ms-2 badge">
                  +{Math.min(PAGE_SIZE, productsCount - visibleCount)} de {productsCount - visibleCount} restantes
                </span>
              </button>
            )}
            {hasVisibleExcess && (
              <button onClick={handleShowLess} className="btn-ver-menos">
                <i className="bi bi-dash-circle me-2" />
                Ver Menos Produtos
              </button>
            )}
          </div>
        )}

        {/* Todos carregados */}
        {hasProducts && !hasMore && visibleCount > PAGE_SIZE && (
          <div className="text-center mt-5 pt-3">
            <p className="text-muted">
              <i className="bi bi-check-circle-fill me-2 text-success" />
              Você já visualizou todos os {productsCount} produtos
            </p>
          </div>
        )}

      </div>
    </section>
  );
}