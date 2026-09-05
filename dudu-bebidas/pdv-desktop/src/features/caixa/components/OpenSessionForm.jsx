export default function OpenSessionForm({ sessionError, openingAmountInput, setOpeningAmountInput, openingSession, onOpen }) {
  return (
    <div className="pdv-open-session-screen">
      <div className="pdv-open-session-card">
        <h1 className="pdv-open-session-title">Abrir caixa</h1>
        <p className="pdv-open-session-subtitle">Informe o valor inicial pra começar a vender.</p>

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
            autoFocus
          />
        </div>
        <button className="adm-btn-new-product" onClick={onOpen} disabled={openingSession}>
          {openingSession ? "Abrindo..." : "🧾 Abrir caixa"}
        </button>
      </div>
    </div>
  );
}
