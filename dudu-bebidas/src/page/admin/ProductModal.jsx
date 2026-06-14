import { CATEGORIES, calcDiscount } from "./adminUtils";

export default function ProductModal({
  productModal,
  modalForm,
  modalSaving,
  modalError,
  handleModalChange,
  handleModalSave,
  setProductModal,
}) {
  return (
    <>
      <div
        className="adm-modal-overlay"
        onClick={() => !modalSaving && setProductModal(null)}
      />
      <div
        className="adm-modal adm-modal-product"
        role="dialog"
        aria-modal="true"
      >
        <div className="adm-modal-icon">
          {productModal === "new" ? "➕" : "✏️"}
        </div>
        <h3 className="adm-modal-title">
          {productModal === "new" ? "Novo Produto" : "Editar Produto"}
        </h3>

        <form onSubmit={handleModalSave} className="adm-product-form">
          <div className="adm-form-row">
            <div className="adm-form-field">
              <label>ID (código)</label>
              <input
                name="id"
                value={modalForm.id}
                onChange={handleModalChange}
                disabled={productModal !== "new"}
                placeholder="ex: 000468"
                required
              />
            </div>
            <div className="adm-form-field">
              <label>Categoria</label>
              <select
                name="category"
                value={modalForm.category}
                onChange={handleModalChange}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="adm-form-field">
            <label>Nome</label>
            <input
              name="name"
              value={modalForm.name}
              onChange={handleModalChange}
              placeholder="Nome do produto"
              required
            />
          </div>

          <div className="adm-form-row">
            <div className="adm-form-field">
              <label>Preço (R$)</label>
              <input
                name="price"
                type="number"
                step="0.01"
                min="0"
                value={modalForm.price}
                onChange={handleModalChange}
                required
              />
            </div>
            <div className="adm-form-field">
              <label>Estoque</label>
              <input
                name="stock"
                type="number"
                min="0"
                value={modalForm.stock}
                onChange={handleModalChange}
                required
              />
            </div>
          </div>

          <div className="adm-form-field">
            <label>Imagem (URL)</label>
            <input
              name="image"
              value={modalForm.image ?? ""}
              onChange={handleModalChange}
              placeholder="https://..."
            />
          </div>

          <div className="adm-form-row">
            <div className="adm-form-field">
              <label>Fornecedor</label>
              <input
                name="supplier"
                value={modalForm.supplier ?? ""}
                onChange={handleModalChange}
              />
            </div>
            <div className="adm-form-field">
              <label>EAN</label>
              <input
                name="ean"
                value={modalForm.ean ?? ""}
                onChange={handleModalChange}
              />
            </div>
          </div>

          <div className="adm-form-checks">
            <label className="adm-form-check">
              <input
                name="is_active"
                type="checkbox"
                checked={modalForm.is_active}
                onChange={handleModalChange}
              />
              Produto ativo
            </label>
            <label className="adm-form-check">
              <input
                name="promotion"
                type="checkbox"
                checked={modalForm.promotion}
                onChange={handleModalChange}
              />
              Em promoção
            </label>
          </div>

          {modalForm.promotion && (
            <div className="adm-promo-fields">
              <p className="adm-promo-hint">
                💡 <strong>Defina abaixo o novo preço promocional.</strong>
              </p>
              <div className="adm-form-row">
                <div className="adm-form-field">
                  <label>Preço antigo (R$)</label>
                  <input
                    name="old_price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={modalForm.old_price ?? ""}
                    onChange={handleModalChange}
                    placeholder="ex: 10.00"
                  />
                </div>
                <div className="adm-form-field">
                  <label>Preço promocional (R$)</label>
                  <input
                    name="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={modalForm.price}
                    onChange={handleModalChange}
                    placeholder="ex: 7.50"
                    required
                  />
                </div>
              </div>

              {modalForm.old_price && modalForm.price && (
                <div className="adm-promo-preview">
                  <span className="adm-preview-label">Preview no card:</span>
                  <span className="adm-preview-old">
                    R$ {Number(modalForm.old_price).toFixed(2)}
                  </span>
                  <span className="adm-preview-new">
                    R$ {Number(modalForm.price).toFixed(2)}
                  </span>
                  {modalForm.old_price > 0 && (
                    <span className="adm-preview-badge">
                      -{calcDiscount(modalForm.old_price, modalForm.price)}% OFF
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {modalError && <div className="adm-modal-error">⚠️ {modalError}</div>}

          <div className="adm-modal-actions">
            <button
              type="button"
              className="adm-modal-btn-back"
              onClick={() => setProductModal(null)}
              disabled={modalSaving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="adm-modal-btn-save"
              disabled={modalSaving}
            >
              {modalSaving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
