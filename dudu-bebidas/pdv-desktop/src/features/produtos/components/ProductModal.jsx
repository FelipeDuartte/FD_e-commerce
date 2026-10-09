import { calcDiscount } from "../utils/productConstants";
import ProductImageField from "./ProductImageField";
import { catalogFilenameToName, isSameNameIgnoringCase } from "../utils/productNameMatch";

export default function ProductModal({
  productModal,
  modalForm,
  modalSaving,
  modalError,
  handleModalChange,
  handleModalSave,
  setProductModal,
  categories = [],
  products = [],
  imageStatus,
  imageError,
  onRemoveImage,
  onSearchAgainImage,
  onRequestDelete,
  imageCandidates = [],
  selectedImageCandidate,
  onSelectImageCandidate,
  similarProducts = [],
  duplicateWarning,
  onConfirmDuplicate,
  onDismissDuplicate,
  onNameBlur,
  onApplyName,
  onOpenProduct,
}) {
  const isPack = Boolean(modalForm.pack_of_product_id);
  // Só produtos avulsos (não-fardo) podem virar base — evita fardo-de-fardo.
  // Exclui o próprio produto em edição, pra não virar base de si mesmo.
  const baseProductOptions = products.filter(
    (p) => !p.pack_of_product_id && p.id !== modalForm.id,
  );

  const catalogName = selectedImageCandidate ? catalogFilenameToName(selectedImageCandidate.filename) : "";
  const showCatalogName = catalogName && !isSameNameIgnoringCase(modalForm.name, catalogName);

  return (
    <>
      <div className="adm-modal-overlay" onClick={() => !modalSaving && setProductModal(null)} />
      <div className="adm-modal adm-modal-product" role="dialog" aria-modal="true">
        <div className="adm-modal-icon">{productModal === "new" ? "➕" : "✏️"}</div>
        <h3 className="adm-modal-title">{productModal === "new" ? "Novo Produto" : "Editar Produto"}</h3>

        <form onSubmit={handleModalSave} className="adm-product-form">
          <div className="adm-form-row">
            <div className="adm-form-field">
              <label>ID (código) — gerado automaticamente</label>
              <input name="id" value={modalForm.id} disabled required />
            </div>
            <div className="adm-form-field">
              <label>Categoria</label>
              <select name="category" value={modalForm.category} onChange={handleModalChange}>
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
              onBlur={onNameBlur}
              placeholder="Nome do produto"
              autoComplete="off"
              required
            />

            {showCatalogName && (
              <div className="adm-name-suggestion">
                <span>
                  📖 No catálogo de imagens está como <strong>{catalogName}</strong>
                </span>
                <button type="button" onClick={() => onApplyName(catalogName)}>
                  Usar esse nome
                </button>
              </div>
            )}

            {similarProducts.length > 0 && (
              <div className="adm-similar-products">
                <span className="adm-similar-products-title">⚠️ Já existe produto parecido cadastrado:</span>
                {similarProducts.map(({ product, nearDuplicate, sameEan }) => (
                  <div key={product.id} className={`adm-similar-product ${nearDuplicate ? "adm-similar-product-dup" : ""}`}>
                    <span>
                      <strong>{product.name}</strong> · {product.stock} em estoque
                      {sameEan ? " · mesmo EAN" : nearDuplicate ? " · mesmo produto?" : ""}
                    </span>
                    <button type="button" onClick={() => onOpenProduct(product)} disabled={modalSaving}>
                      Abrir esse
                    </button>
                  </div>
                ))}
              </div>
            )}
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
                disabled={isPack}
                required
              />
              {isPack && <span className="adm-field-hint">Calculado a partir do produto avulso.</span>}
            </div>
          </div>

          <div className="adm-form-field">
            <label>Imagem</label>
            <ProductImageField
              modalForm={modalForm}
              imageStatus={imageStatus}
              imageError={imageError}
              onRemoveImage={onRemoveImage}
              onSearchAgain={onSearchAgainImage}
              candidates={imageCandidates}
              onSelectCandidate={onSelectImageCandidate}
            />
          </div>

          <div className="adm-form-row">
            <div className="adm-form-field">
              <label>Fornecedor</label>
              <input name="supplier" value={modalForm.supplier ?? ""} onChange={handleModalChange} />
            </div>
            <div className="adm-form-field">
              <label>EAN</label>
              <input name="ean" value={modalForm.ean ?? ""} onChange={handleModalChange} />
            </div>
          </div>

          <div className="adm-pack-fields">
            <p className="adm-pack-hint">
              📦 <strong>Este produto é um fardo/caixa fechada de outro item?</strong> Selecione o produto
              avulso abaixo — o estoque do fardo passa a ser calculado sozinho a partir do estoque dele,
              em vez de ter um número próprio pra manter atualizado na mão.
            </p>
            <div className="adm-form-row">
              <div className="adm-form-field">
                <label>Produto avulso</label>
                <select name="pack_of_product_id" value={modalForm.pack_of_product_id ?? ""} onChange={handleModalChange}>
                  <option value="">— Não é fardo, produto avulso —</option>
                  {baseProductOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              {isPack && (
                <div className="adm-form-field">
                  <label>Unidades por fardo</label>
                  <input
                    name="pack_units"
                    type="number"
                    min="2"
                    autoComplete="off"
                    value={modalForm.pack_units ?? ""}
                    onChange={handleModalChange}
                    placeholder="ex: 12"
                    required
                  />
                </div>
              )}
            </div>
          </div>

          <div className="adm-form-checks">
            <label className="adm-form-check">
              <input name="is_active" type="checkbox" checked={modalForm.is_active} onChange={handleModalChange} />
              Produto ativo
            </label>
            <label className="adm-form-check">
              <input
                name="show_on_site"
                type="checkbox"
                checked={modalForm.show_on_site}
                onChange={handleModalChange}
              />
              Mostrar no site
            </label>
            <label className="adm-form-check">
              <input name="promotion" type="checkbox" checked={modalForm.promotion} onChange={handleModalChange} />
              Em promoção (catálogo online)
            </label>
          </div>

          {modalForm.promotion && (
            <div className="adm-promo-fields">
              <p className="adm-promo-hint">
                💡 <strong>Defina abaixo o novo preço promocional.</strong> Vale só pro site — no balcão o
                preço cobrado é sempre o de tabela (preço antigo), a promoção não é aplicada no PDV.
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
                  <span className="adm-preview-old">R$ {Number(modalForm.old_price).toFixed(2)}</span>
                  <span className="adm-preview-new">R$ {Number(modalForm.price).toFixed(2)}</span>
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

          {duplicateWarning && (
            <div className="adm-duplicate-confirm" role="alert">
              <p>
                ⚠️ <strong>{duplicateWarning.map((d) => d.product.name).join(", ")}</strong> já está cadastrado
                {duplicateWarning.length > 1 ? "s" : ""}. É outro produto mesmo?
              </p>
              <div className="adm-duplicate-confirm-actions">
                <button type="button" className="adm-modal-btn-back" onClick={() => onOpenProduct(duplicateWarning[0].product)} disabled={modalSaving}>
                  Abrir o existente
                </button>
                <button type="button" className="adm-modal-btn-back" onClick={onDismissDuplicate} disabled={modalSaving}>
                  Corrigir o nome
                </button>
                <button type="button" className="adm-modal-btn-save" onClick={onConfirmDuplicate} disabled={modalSaving}>
                  É outro, salvar
                </button>
              </div>
            </div>
          )}

          <div className="adm-modal-actions">
            {productModal !== "new" && (
              <button
                type="button"
                className="adm-btn-delete"
                onClick={() => onRequestDelete(productModal)}
                disabled={modalSaving}
              >
                🗑️ Excluir
              </button>
            )}
            <button
              type="button"
              className="adm-modal-btn-back"
              onClick={() => setProductModal(null)}
              disabled={modalSaving}
            >
              Cancelar
            </button>
            <button type="submit" className="adm-modal-btn-save" disabled={modalSaving || Boolean(duplicateWarning)}>
              {modalSaving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
