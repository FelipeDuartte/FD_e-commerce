import { formatBRL } from "../../../shared/utils/format";
import ProductModal from "./ProductModal";
import DeleteProductModal from "./DeleteProductModal";
import RegisterPurchaseModal from "./RegisterPurchaseModal";
import ActionsMenu from "../../../shared/components/ActionsMenu";

export default function ProdutosView({ produtos, categories }) {
  const {
    products, filteredProducts, productsLoading, productsError,
    productSearch, setProductSearch, productCategory, setProductCategory,
    productModal, setProductModal, modalForm, modalSaving, modalError,
    handleModalChange, handleModalSave, togglingId, openNewProduct,
    openEditProduct, handleToggleActive, productImageSearch,
    productToDelete, deleting, deleteError, requestDelete, dismissDelete, confirmDelete,
    productToPurchase, requestPurchase, dismissPurchase, confirmPurchase, confirmBonus,
  } = produtos;

  return (
    <>
      {productModal && (
        <ProductModal
          productModal={productModal}
          modalForm={modalForm}
          modalSaving={modalSaving}
          modalError={modalError}
          handleModalChange={handleModalChange}
          handleModalSave={handleModalSave}
          setProductModal={setProductModal}
          categories={categories}
          products={products}
          imageStatus={productImageSearch.status}
          imageError={productImageSearch.error}
          imageProgress={productImageSearch.progress}
          onUploadImage={productImageSearch.uploadImage}
          onResetImage={productImageSearch.resetToManual}
          onRequestDelete={(product) => {
            setProductModal(null);
            requestDelete(product);
          }}
        />
      )}

      {productToDelete && (
        <DeleteProductModal
          product={productToDelete}
          deleting={deleting}
          deleteError={deleteError}
          onConfirm={confirmDelete}
          onDismiss={dismissDelete}
        />
      )}

      {productToPurchase && (
        <RegisterPurchaseModal
          product={productToPurchase}
          onConfirmPurchase={confirmPurchase}
          onConfirmBonus={confirmBonus}
          onDismiss={dismissPurchase}
        />
      )}

      <div className="adm-title-row">
        <div>
          <h1 className="adm-title">Gestão de Produtos</h1>
          <p className="adm-subtitle">
            {filteredProducts.length} de {products.length} produtos
          </p>
        </div>
        <button className="adm-btn-new-product" onClick={openNewProduct}>
          + Novo Produto
        </button>
      </div>

      <div className="adm-product-filters">
        <input
          className="adm-product-search"
          placeholder="🔍 Buscar produto..."
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
        />
        <select
          className="adm-product-cat-filter"
          value={productCategory}
          onChange={(e) => setProductCategory(e.target.value)}
        >
          <option value="todos">Todas categorias</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {productsError && <div className="adm-modal-error">⚠️ {productsError}</div>}

      {productsLoading ? (
        <div className="adm-loading">
          <div className="adm-spinner" />
          <p>Carregando produtos...</p>
        </div>
      ) : (
        <div className="adm-product-table-wrap">
          <table className="adm-product-table">
            <thead>
              <tr>
                {["ID", "Nome", "Categoria", "Preço", "Custo", "Margem", "Estoque", "Status", "Ações"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => (
                <tr key={p.id} className={!p.is_active ? "adm-row-inactive" : ""}>
                  <td className="adm-td-id">{p.id}</td>
                  <td className="adm-td-name">{p.name}</td>
                  <td>
                    <span className="adm-cat-badge">{p.category}</span>
                  </td>
                  <td>{formatBRL(p.price)}</td>
                  <td>{p.cost_price ? formatBRL(p.cost_price) : "—"}</td>
                  <td>
                    {p.cost_price ? (
                      <span>
                        {formatBRL(p.price - p.cost_price)}
                        {" "}
                        ({(((p.price - p.cost_price) / p.price) * 100).toFixed(0)}%)
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <span className={`adm-stock-badge ${p.stock === 0 ? "zero" : p.stock < 10 ? "low" : "ok"}`}>
                      {p.stock}
                    </span>
                  </td>
                  <td>
                    <span className={`adm-status-pill ${p.is_active ? "active" : "inactive"}`}>
                      {p.is_active ? "✅ Ativo" : "🚫 Inativo"}
                    </span>
                  </td>
                  <td className="adm-td-actions">
                    <ActionsMenu>
                      <button onClick={() => openEditProduct(p)}>✏️ Editar</button>
                      <button onClick={() => requestPurchase(p)}>📦 Comprar</button>
                      <button onClick={() => handleToggleActive(p)} disabled={togglingId === p.id}>
                        {togglingId === p.id ? "..." : p.is_active ? "🚫 Desativar" : "✅ Ativar"}
                      </button>
                      <button className="pdv-actions-menu-danger" onClick={() => requestDelete(p)}>
                        🗑️ Excluir
                      </button>
                    </ActionsMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredProducts.length === 0 && (
            <div className="adm-empty">
              <p>Nenhum produto encontrado.</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
