const DOCUMENT_TYPES = ["Boleto", "Nota Fiscal", "Recibo", "Outro"];

export default function BillModal({
  billModal,
  modalForm,
  repeatMonths,
  setRepeatMonths,
  modalSaving,
  modalError,
  handleModalChange,
  handleModalSave,
  setBillModal,
}) {
  const isNew = billModal === "new";

  return (
    <>
      <div className="adm-modal-overlay" onClick={() => !modalSaving && setBillModal(null)} />
      <div className="adm-modal adm-modal-bill" role="dialog" aria-modal="true">
        <h2 className="adm-store-section-title">{isNew ? "Nova conta a pagar" : "Editar conta"}</h2>

        {modalError && <div className="adm-modal-error">⚠️ {modalError}</div>}

        <form onSubmit={handleModalSave} className="adm-product-form">
          <div className="adm-form-field">
            <label>Referente a *</label>
            <input
              name="description"
              value={modalForm.description}
              onChange={handleModalChange}
              placeholder="Ex: Consórcio casa, Honorário contábil..."
              autoFocus
            />
          </div>

          <div className="adm-form-row" style={{ flexWrap: "wrap" }}>
            <div className="adm-form-field">
              <label>Fornecedor</label>
              <input name="supplier" value={modalForm.supplier} onChange={handleModalChange} />
            </div>
            <div className="adm-form-field">
              <label>Categoria</label>
              <input
                name="category"
                value={modalForm.category}
                onChange={handleModalChange}
                placeholder="Ex: Despesa fixa, Despesa variável..."
              />
            </div>
          </div>

          <div className="adm-form-row" style={{ flexWrap: "wrap" }}>
            <div className="adm-form-field">
              <label>Valor (R$) *</label>
              <input
                name="amount"
                type="number"
                min="0"
                step="0.01"
                value={modalForm.amount}
                onChange={handleModalChange}
              />
            </div>
            <div className="adm-form-field">
              <label>Vencimento *</label>
              <input name="due_date" type="date" value={modalForm.due_date} onChange={handleModalChange} />
            </div>
          </div>

          <div className="adm-form-row" style={{ flexWrap: "wrap" }}>
            <div className="adm-form-field">
              <label>Tipo de documento</label>
              <select name="document_type" value={modalForm.document_type} onChange={handleModalChange}>
                <option value="">—</option>
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="adm-form-field">
              <label>Número do documento</label>
              <input name="document_number" value={modalForm.document_number} onChange={handleModalChange} />
            </div>
          </div>

          {isNew && (
            <div className="adm-form-field">
              <label>Repetir por quantos meses</label>
              <input
                type="number"
                min="1"
                max="36"
                value={repeatMonths}
                onChange={(e) => setRepeatMonths(Number(e.target.value) || 1)}
              />
              <p className="pdv-bill-hint">
                Cria uma conta igual a essa, mês a mês, pra contas recorrentes (ex: consórcio).
              </p>
            </div>
          )}

          <div className="adm-form-field">
            <label>Observações</label>
            <textarea name="notes" value={modalForm.notes} onChange={handleModalChange} rows={2} />
          </div>

          <div className="adm-store-form-actions">
            <button className="adm-btn-new-product" type="submit" disabled={modalSaving}>
              {modalSaving ? "Salvando..." : "Salvar"}
            </button>
            <button className="adm-btn-back" type="button" onClick={() => setBillModal(null)} disabled={modalSaving}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
