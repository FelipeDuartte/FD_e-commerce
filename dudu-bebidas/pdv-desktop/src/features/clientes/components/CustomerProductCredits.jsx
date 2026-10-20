// Crédito é de PRODUTO, não dinheiro (ver migration 0043): devolveu 1 caixa
// já paga, retira 1 caixa do mesmo produto depois.
export default function CustomerProductCredits({ credits, loading, onRedeem, onRegisterReturn }) {
  return (
    <div className="pdv-product-credits">
      <div className="pdv-product-credits-head">
        <h3 className="adm-store-section-title pdv-fiado-orders-title">🎁 Créditos de produto</h3>
        <button type="button" className="pdv-clientes-secondary-btn" onClick={onRegisterReturn}>
          ↩️ Registrar devolução
        </button>
      </div>

      {loading ? null : credits.length === 0 ? (
        <p className="pdv-product-credits-empty">
          Nenhum crédito. Quando o cliente devolve um produto que já pagou, ele aparece aqui pra retirar depois.
        </p>
      ) : (
        <div className="pdv-product-credits-list">
          {credits.map((c) => (
            <div key={c.productId} className="pdv-product-credits-row">
              <span>{c.productName}</span>
              <strong>{c.quantity} un.</strong>
              <button type="button" className="adm-btn-new-product pdv-product-credits-redeem" onClick={() => onRedeem(c)}>
                Retirar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
