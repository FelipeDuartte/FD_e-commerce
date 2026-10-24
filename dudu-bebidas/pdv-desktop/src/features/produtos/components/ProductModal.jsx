import { useEffect, useState } from "react";
import { calcDiscount } from "../utils/productConstants";
import ProductImageField from "./ProductImageField";
import { catalogFilenameToName, isSameNameIgnoringCase } from "../utils/productNameMatch";

function Switch({ name, checked, onChange, title, description }) {
  return (
    <label className="pm-switch">
      <input name={name} type="checkbox" checked={checked} onChange={onChange} />
      <span className="pm-switch-track" aria-hidden="true" />
      <span className="pm-switch-text">
        <strong>{title}</strong>
        {description && <small>{description}</small>}
      </span>
    </label>
  );
}

function Section({ title, children }) {
  return (
    <section className="pm-section">
      <h4 className="pm-section-title">{title}</h4>
      {children}
    </section>
  );
}

function PromoPreview({ label, from, to }) {
  if (!(from > 0 && to > 0)) return null;
  return (
    <div className="adm-promo-preview">
      <span className="adm-preview-label">{label}</span>
      <span className="adm-preview-old">R$ {from.toFixed(2)}</span>
      <span className="adm-preview-new">R$ {to.toFixed(2)}</span>
      {to < from && <span className="adm-preview-badge">-{calcDiscount(from, to)}% OFF</span>}
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
  const isNew = productModal === "new";
  const isPack = Boolean(modalForm.pack_of_product_id);
  const [wantsPack, setWantsPack] = useState(false);
  const showPack = isPack || wantsPack;

  // Trocou de produto sem fechar o modal (ex: "Abrir esse" num parecido).
  useEffect(() => {
    setWantsPack(false);
  }, [modalForm.id]);

  const close = () => !modalSaving && setProductModal(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const setField = (name, value) => handleModalChange({ target: { name, value, type: "text" } });

  // Só produtos avulsos (não-fardo) podem virar base — evita fardo-de-fardo.
  const baseProductOptions = products.filter((p) => !p.pack_of_product_id && p.id !== modalForm.id);

  // Um "preço de venda" só na tela. No banco, com a promoção do site ligada,
  // o preço normal fica em old_price e o promocional em price (é o que o
  // site lê) — por isso o campo principal troca de coluna conforme a promoção.
  const salePriceField = modalForm.promotion ? "old_price" : "price";
  const salePrice = Number(modalForm[salePriceField]) || 0;

  const toggleSitePromo = (e) => {
    const on = e.target.checked;
    if (on) {
      setField("old_price", modalForm.price);
    } else if (modalForm.old_price !== "" && modalForm.old_price != null) {
      setField("price", modalForm.old_price);
    }
    handleModalChange({ target: { name: "promotion", type: "checkbox", checked: on } });
  };

  const togglePack = (e) => {
    const on = e.target.checked;
    setWantsPack(on);
    if (!on) setField("pack_of_product_id", "");
  };

  const catalogName = selectedImageCandidate ? catalogFilenameToName(selectedImageCandidate.filename) : "";
  const showCatalogName = catalogName && !isSameNameIgnoringCase(modalForm.name, catalogName);

  return (
    <>
      <div className="adm-modal-overlay" onClick={close} />
      <div className="adm-modal pm-modal" role="dialog" aria-modal="true" aria-labelledby="pm-title">
        <header className="pm-header">
          <div>
            <h3 id="pm-title" className="pm-title">{isNew ? "Novo produto" : "Editar produto"}</h3>
            <span className="pm-subtitle">Código {modalForm.id}{!isNew && modalForm.name ? ` · ${modalForm.name}` : ""}</span>
          </div>
          <button type="button" className="pm-close" onClick={close} title="Fechar (Esc)" disabled={modalSaving}>
            ✕
          </button>
        </header>

        <form onSubmit={handleModalSave} className="pm-form">
          <div className="pm-body">
            <Section title="Identificação">
              <div className="adm-form-field">
                <label htmlFor="pm-name">Nome</label>
                <input
                  id="pm-name"
                  name="name"
                  value={modalForm.name}
                  onChange={handleModalChange}
                  onBlur={onNameBlur}
                  placeholder="Ex: Brahma lata 350ml"
                  autoComplete="off"
                  autoFocus={isNew}
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

              <div className="pm-grid">
                <div className="adm-form-field">
                  <label htmlFor="pm-category">Categoria</label>
                  <select id="pm-category" name="category" value={modalForm.category} onChange={handleModalChange}>
                    {!modalForm.category && <option value="">Selecione…</option>}
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="adm-form-field">
                  <label htmlFor="pm-ean">Código de barras (EAN)</label>
                  <input id="pm-ean" name="ean" value={modalForm.ean ?? ""} onChange={handleModalChange} inputMode="numeric" />
                </div>
                <div className="adm-form-field">
                  <label htmlFor="pm-supplier">Fornecedor</label>
                  <input id="pm-supplier" name="supplier" value={modalForm.supplier ?? ""} onChange={handleModalChange} />
                </div>
              </div>
            </Section>

            <Section title="Preço e estoque">
              <div className="pm-grid">
                <div className="adm-form-field">
                  <label htmlFor="pm-price">Preço de venda (R$)</label>
                  <input
                    id="pm-price"
                    name={salePriceField}
                    type="number"
                    step="0.01"
                    min="0"
                    value={modalForm[salePriceField] ?? ""}
                    onChange={handleModalChange}
                    required
                  />
                </div>
                <div className="adm-form-field">
                  <label htmlFor="pm-stock">Estoque</label>
                  <input
                    id="pm-stock"
                    name="stock"
                    type="number"
                    min="0"
                    value={modalForm.stock}
                    onChange={handleModalChange}
                    disabled={isPack}
                    required
                  />
                  {isPack && <span className="adm-field-hint">Calculado pelo estoque do produto avulso.</span>}
                </div>
              </div>

              <Switch
                checked={showPack}
                onChange={togglePack}
                title="É fardo/caixa de outro produto"
                description="O estoque passa a ser calculado sozinho pelo estoque do produto avulso."
              />
              {showPack && (
                <div className="pm-grid pm-nested">
                  <div className="adm-form-field">
                    <label htmlFor="pm-pack-of">Produto avulso</label>
                    <select
                      id="pm-pack-of"
                      name="pack_of_product_id"
                      value={modalForm.pack_of_product_id ?? ""}
                      onChange={handleModalChange}
                      required
                    >
                      <option value="" disabled>Escolha o produto avulso...</option>
                      {baseProductOptions.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="adm-form-field">
                    <label htmlFor="pm-pack-units">Unidades por fardo</label>
                    <input
                      id="pm-pack-units"
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
                </div>
              )}
            </Section>

            <Section title="Imagem">
              <ProductImageField
                modalForm={modalForm}
                imageStatus={imageStatus}
                imageError={imageError}
                onRemoveImage={onRemoveImage}
                onSearchAgain={onSearchAgainImage}
                candidates={imageCandidates}
                onSelectCandidate={onSelectImageCandidate}
              />
            </Section>

            <Section title="Onde aparece">
              <div className="pm-switch-grid">
                <Switch
                  name="is_active"
                  checked={modalForm.is_active}
                  onChange={handleModalChange}
                  title="Produto ativo"
                  description="Desligado, não aparece na Venda nem no site."
                />
                <Switch
                  name="show_on_site"
                  checked={modalForm.show_on_site}
                  onChange={handleModalChange}
                  title="Mostrar no site"
                  description="Desligado, vende só no balcão."
                />
              </div>
            </Section>

            <Section title="Promoções">
              <div className="pm-promo-grid">
                <div className={`pm-promo-card ${modalForm.promotion ? "on" : ""}`}>
                  <Switch
                    name="promotion"
                    checked={modalForm.promotion}
                    onChange={toggleSitePromo}
                    title="Promoção no site"
                    description="Só no catálogo online."
                  />
                  {modalForm.promotion && (
                    <>
                      <div className="adm-form-field">
                        <label htmlFor="pm-site-promo">Preço promocional no site (R$)</label>
                        <input
                          id="pm-site-promo"
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
                      <PromoPreview label="No site:" from={salePrice} to={Number(modalForm.price)} />
                    </>
                  )}
                </div>

                <div className={`pm-promo-card ${modalForm.pdv_promotion ? "on" : ""}`}>
                  <Switch
                    name="pdv_promotion"
                    checked={modalForm.pdv_promotion}
                    onChange={handleModalChange}
                    title="Promoção no PDV"
                    description="Só no balcão, o operador aplica na Venda."
                  />
                  {modalForm.pdv_promotion && (
                    <>
                      <div className="adm-form-field">
                        <label htmlFor="pm-pdv-promo">Preço promocional no PDV (R$)</label>
                        <input
                          id="pm-pdv-promo"
                          name="pdv_promo_price"
                          type="number"
                          step="0.01"
                          min="0"
                          value={modalForm.pdv_promo_price ?? ""}
                          onChange={handleModalChange}
                          placeholder="ex: 7.50"
                          required
                        />
                      </div>
                      <PromoPreview label="No balcão:" from={salePrice} to={Number(modalForm.pdv_promo_price)} />
                    </>
                  )}
                </div>
              </div>
            </Section>
          </div>

          <footer className="pm-footer">
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

            <div className="pm-actions">
              {!isNew && (
                <button
                  type="button"
                  className="pm-delete"
                  onClick={() => onRequestDelete(productModal)}
                  disabled={modalSaving}
                >
                  🗑️ Excluir
                </button>
              )}
              <div className="pm-actions-main">
                <button type="button" className="adm-modal-btn-back" onClick={close} disabled={modalSaving}>
                  Cancelar
                </button>
                <button type="submit" className="adm-modal-btn-save" disabled={modalSaving || Boolean(duplicateWarning)}>
                  {modalSaving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </footer>
        </form>
      </div>
    </>
  );
}
