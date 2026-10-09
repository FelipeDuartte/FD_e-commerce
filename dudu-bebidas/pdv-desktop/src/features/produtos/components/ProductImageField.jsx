import { imgProduto } from "../utils/Cloudnary";
import { catalogFilenameToName } from "../utils/productNameMatch";

// Imagem vem só do catálogo mestre — não existe upload manual.
export default function ProductImageField({
  modalForm, imageStatus, imageError, onRemoveImage, onSearchAgain,
  candidates = [], onSelectCandidate,
}) {
  const previewUrl = modalForm.image ? imgProduto(modalForm.image) : null;
  const isSearching = imageStatus === "searching";
  const isFound = imageStatus === "found";
  const isNotFound = imageStatus === "not_found";
  const isSaved = imageStatus === "saved";
  const canSearchAgain = (isSaved || isNotFound) && (modalForm.name ?? "").trim().length >= 3;

  return (
    <div className="adm-image-field">
      {isSearching && <div className="adm-image-status adm-image-status-searching">🔍 Procurando imagem...</div>}
      {isFound && <div className="adm-image-status adm-image-status-found">✅ Imagem encontrada no catálogo</div>}
      {isNotFound && !previewUrl && candidates.length === 0 && (
        <div className="adm-image-status adm-image-status-not-found">
          ❌ Nenhuma imagem no catálogo — confira se o nome está escrito certo
        </div>
      )}
      {imageError && <div className="adm-image-status adm-image-status-error">⚠️ {imageError}</div>}

      {previewUrl ? (
        <div className="adm-image-preview-wrap">
          <img src={previewUrl} alt="Preview do produto" className="adm-image-preview" />
          <div className="adm-image-preview-actions">
            {canSearchAgain && (
              <button type="button" className="adm-image-change-btn" onClick={onSearchAgain}>
                🔍 Buscar no catálogo
              </button>
            )}
            <button type="button" className="adm-image-remove-btn" onClick={onRemoveImage} disabled={isSearching}>
              🗑️ Remover
            </button>
          </div>
        </div>
      ) : (
        <div className="adm-image-empty">
          {isSearching ? (
            <span>Aguardando busca no catálogo...</span>
          ) : canSearchAgain ? (
            <button type="button" className="adm-image-change-btn" onClick={onSearchAgain}>
              🔍 Buscar no catálogo
            </button>
          ) : (
            <span>A imagem aparece sozinha quando o nome do produto bate com o catálogo.</span>
          )}
        </div>
      )}

      {isFound && candidates.length > 1 && (
        <div className="adm-image-candidates">
          <span className="adm-image-candidates-label">Não é essa? Outras do catálogo:</span>
          <div className="adm-image-candidates-list">
            {candidates.map((c) => (
              <button
                key={c.url}
                type="button"
                className={`adm-image-candidate ${c.url === modalForm.image ? "adm-image-candidate-active" : ""}`}
                onClick={() => onSelectCandidate(c.url)}
                title={catalogFilenameToName(c.filename)}
              >
                <img src={imgProduto(c.url)} alt="" />
                <span>{catalogFilenameToName(c.filename)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {isSaved && previewUrl && <p className="adm-image-hint">Imagem já salva neste produto.</p>}
    </div>
  );
}
