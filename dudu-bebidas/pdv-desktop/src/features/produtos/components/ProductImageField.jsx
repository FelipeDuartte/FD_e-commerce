import { useRef, useState } from "react";
import { imgProduto } from "../utils/Cloudnary";

const ACCEPTED_TYPES = "image/png,image/jpeg,image/webp";

export default function ProductImageField({ modalForm, imageStatus, imageError, imageProgress, onUploadImage, onResetImage }) {
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
      <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} onChange={handleInputChange} hidden />

      {isSearching && <div className="adm-image-status adm-image-status-searching">🔍 Procurando imagem...</div>}
      {isFound && <div className="adm-image-status adm-image-status-found">✅ Imagem encontrada automaticamente</div>}
      {isNotFound && !isUploading && (
        <div className="adm-image-status adm-image-status-not-found">❌ Nenhuma imagem encontrada no catálogo</div>
      )}
      {imageError && <div className="adm-image-status adm-image-status-error">⚠️ {imageError}</div>}

      {previewUrl ? (
        <div className="adm-image-preview-wrap">
          <img src={previewUrl} alt="Preview do produto" className="adm-image-preview" />
          <div className="adm-image-preview-actions">
            <button type="button" className="adm-image-change-btn" onClick={openFilePicker} disabled={isUploading}>
              🔁 Trocar imagem
            </button>
            <button type="button" className="adm-image-remove-btn" onClick={onResetImage} disabled={isUploading}>
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
          <div className="adm-image-progress-fill" style={{ width: `${imageProgress}%` }} />
        </div>
      )}

      {isManual && !isUploading && previewUrl && <p className="adm-image-hint">Imagem definida manualmente.</p>}
    </div>
  );
}
