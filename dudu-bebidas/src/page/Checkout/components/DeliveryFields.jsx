export default function DeliveryFields({
  address, handleAddressChange, cep, handleCepChange, handleCepBlur,
  cepLoading, cepError, bairroCarrinho, isDisabled, errorMsg, cepDigits,
}) {
  return (
    <>
      {bairroCarrinho && (
        <div className="co-bairros-info">
          📍 Entregando em: <strong>{bairroCarrinho}</strong>
        </div>
      )}

      <div className="co-field-row">
        <div className="co-field">
          <label>CEP</label>
          <div className="co-cep-wrap">
            <input
              type="text"
              value={cep}
              onChange={handleCepChange}
              onBlur={handleCepBlur}
              placeholder="00000-000"
              maxLength={9}
              className={
                cepError || (errorMsg && cepDigits.length !== 8)
                  ? "co-input-error"
                  : ""
              }
              disabled={isDisabled}
            />
            {cepLoading && <span className="co-cep-loading">🔍</span>}
          </div>
          {cepError && <span className="co-field-error">{cepError}</span>}
          {!cepError && address.city && (
            <span className="co-field-success">
              ✓ {address.city} — {address.state}
            </span>
          )}
        </div>
        <div className="co-field">
          <label>Número</label>
          <input
            type="text"
            name="number"
            value={address.number}
            onChange={handleAddressChange}
            placeholder="123"
            disabled={isDisabled}
            className={errorMsg && !address.number.trim() ? "co-input-error" : ""}
          />
        </div>
      </div>

      <div className="co-field-row single">
        <div className="co-field">
          <label>Endereço</label>
          <input
            type="text"
            name="street"
            value={address.street}
            onChange={handleAddressChange}
            placeholder="Rua / Av. — preenchido pelo CEP"
            disabled={isDisabled}
            className={errorMsg && !address.street.trim() ? "co-input-error" : ""}
          />
        </div>
      </div>

      <div className="co-field-row two-col-mobile">
        <div className="co-field">
          <label>Bairro</label>
          <input
            type="text"
            name="district"
            value={address.district}
            onChange={handleAddressChange}
            placeholder="Bairro — preenchido pelo CEP"
            disabled={isDisabled}
            className={errorMsg && !address.district.trim() ? "co-input-error" : ""}
          />
        </div>
        <div className="co-field">
          <label>Complemento</label>
          <input
            type="text"
            name="complement"
            value={address.complement}
            onChange={handleAddressChange}
            placeholder="Apto, bloco..."
            disabled={isDisabled}
          />
        </div>
      </div>
    </>
  );
}
