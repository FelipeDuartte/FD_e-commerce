export default function OpenSessionForm({ sessionError, openingAmountInput, setOpeningAmountInput, openingSession, onOpen }) {
  return (
    <>
      <div className="adm-title-row">
        <div>
          <h1 className="adm-title">PDV — Venda de Balcão</h1>
          <p className="adm-subtitle">Abra o caixa para começar a vender.</p>
        </div>
      </div>
      <div className="pdv-open-session">
        {sessionError && <div className="adm-modal-error">⚠️ {sessionError}</div>}
        <div className="adm-form-field">
          <label>Valor inicial em caixa (R$)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={openingAmountInput}
            onChange={(e) => setOpeningAmountInput(e.target.value)}
            placeholder="0,00"
          />
        </div>
        <button className="adm-btn-new-product" onClick={onOpen} disabled={openingSession}>
          {openingSession ? "Abrindo..." : "🧾 Abrir caixa"}
        </button>
      </div>
    </>
  );
}
