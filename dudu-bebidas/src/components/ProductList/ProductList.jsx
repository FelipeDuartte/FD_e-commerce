// import components
import ProductCard from "../ProductCard/ProductCard";
// import styles
import "./Products.css";

export default function ProductList({
  filteredProducts,
  selectedCategory,
  setSelectedCategory,
  addToCart,
}) {
  const hasProducts = filteredProducts.length > 0;
  const productsCount = filteredProducts.length;

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
  };

  const categories = [
    { id: "todos",        label: "Todos",         icon: "bi-grid-fill" },
    { id: "cerveja",      label: "Cervejas",      icon: "bi-cup-straw" },
    { id: "vinho",        label: "Vinhos",         icon: "bi-cup" },
    { id: "destilado",    label: "Destilados",    icon: "bi-droplet-fill" },
    { id: "refrigerante", label: "Refrigerantes", icon: "bi-cup-hot-fill" },
    { id: "energetico",   label: "Energéticos",   icon: "bi-lightning-charge-fill" },
  ];

  return (
    <section id="produtos" className="py-5">
      <div className="container">

        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-5 flex-wrap gap-3">
          <div>
            <h2 className="section-title fw-bold">Nossos Produtos</h2>
          </div>
          <div className="text-end">
            <span className="badge bg-dark">
              {productsCount} produtos disponíveis
            </span>
          </div>
        </div>

        {/* Category Filters
            ─ filter-scroll-wrapper tem os fades (::before / ::after)
            ─ overflow-x-auto faz o scroll, sem pseudo-elementos próprios
        */}
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
            filteredProducts.map((produto, index) => (
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

      </div>
    </section>
  );
}