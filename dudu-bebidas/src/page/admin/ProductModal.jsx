import { useRef, useState } from "react";
import { calcDiscount } from "./adminUtils";
import { imgProduto } from "../../utils/Cloudnary";

const ACCEPTED_TYPES = "image/png,image/jpeg,image/webp";

function ProductImageField({
  modalForm,
  imageStatus,
  imageError,
  imageProgress,
  onUploadImage,
  onResetImage,
}) {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const previewUrl = modalForm.image ? imgProduto(modalForm.image) : null;
  const isSearching = imageStatus === "searching";
  const isUploading = imageStatus === "uploading";
  const isFound = imageStatus === "found";
  const isNotFound = imageStatus === "not_found";
  const isManual = imageStatus === "manual";

  const openFilePicker = () => fileInputRef.current?.click();

  const handleFileSelected = (file) => {
    if (!file || isUploading) return;
    onUploadImage(file);
  };

  const handleInputChange = (e) => {
    handleFileSelected(e.target.files?.[0]);
    e.target.value = ""; // permite selecionar o mesmo arquivo de novo
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelected(e.dataTransfer.files?.[0]);
  };

  return (
    <div className="adm-image-field">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handleInputChange}
        hidden
      />

      {/* Indicador de status da busca automática */}
      {isSearching && (
        <div className="adm-image-status adm-image-status-searching">
          🔍 Procurando imagem...
        </div>
      )}
      {isFound && (
        <div className="adm-image-status adm-image-status-found">
          ✅ Imagem encontrada automaticamente
        </div>
      )}
      {isNotFound && !isUploading && (
        <div className="adm-image-status adm-image-status-not-found">
          ❌ Nenhuma imagem encontrada no catálogo
        </div>
      )}
      {imageError && <div className="adm-image-status adm-image-status-error">⚠️ {imageError}</div>}

      {/* Preview + dropzone */}
      {previewUrl ? (
        <div className="adm-image-preview-wrap">
          <img src={previewUrl} alt="Preview do produto" className="adm-image-preview" />
          <div className="adm-image-preview-actions">
            <button
              type="button"
              className="adm-image-change-btn"
              onClick={openFilePicker}
              disabled={isUploading}
            >
              🔁 Trocar imagem
            </button>
            <button
              type="button"
              className="adm-image-remove-btn"
              onClick={onResetImage}
              disabled={isUploading}
            >
              🗑️ Remover
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`adm-image-dropzone ${dragOver ? "adm-image-dropzone-active" : ""}`}
          onClick={!isUploading ? openFilePicker : undefined}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {isUploading ? (
            <span>Enviando imagem...</span>
          ) : isSearching ? (
            <span>Aguardando busca automática...</span>
          ) : (
            <span>📤 Arraste uma imagem aqui ou clique para selecionar</span>
          )}
        </div>
      )}

      {isUploading && (
        <div className="adm-image-progress-track">
          <div
            className="adm-image-progress-fill"
            style={{ width: `${imageProgress}%` }}
          />
        </div>
      )}

      {isManual && !isUploading && previewUrl && (
        <p className="adm-image-hint">Imagem definida manualmente.</p>
      )}
    </div>
  );
}

export default function ProductModal({
  productModal,
  modalForm,
  modalSaving,
  modalError,
  handleModalChange,
  handleModalSave,
  setProductModal,
  categories = [],   // ← recebido do Admin.jsx via hook useAdminCategories
  imageStatus,
  imageError,
  imageProgress,
  onUploadImage,
  onResetImage,
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
                {categories.map((c) => (
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
            <label>Imagem</label>
            <ProductImageField
              modalForm={modalForm}
              imageStatus={imageStatus}
              imageError={imageError}
              imageProgress={imageProgress}
              onUploadImage={onUploadImage}
              onResetImage={onResetImage}
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