import "./Checkout.css";

export default function Checkout() {
    
  return (
    <div className="checkout">

      <div className="checkout-container">

        <h1 className="checkout-title">Finalizar Pedido</h1>

        <div className="checkout-grid">

          {/* FORMULÁRIO */}
          <div className="checkout-form">

            <h2>Informações de Entrega</h2>

            <div className="form-group">
              <input type="text" placeholder="Nome completo" />
              <input type="text" placeholder="Telefone" />
            </div>

            <div className="form-group">
              <input type="text" placeholder="Endereço" />
              <input type="text" placeholder="Número" />
            </div>

            <div className="form-group">
              <input type="text" placeholder="Bairro" />
              <input type="text" placeholder="Complemento" />
            </div>

            <h2 className="payment-title">Forma de Pagamento</h2>

            <div className="payment-options">

              <label className="payment-card">
                <input type="radio" name="payment"/>
                <span>PIX</span>
              </label>

              <label className="payment-card">
                <input type="radio" name="payment"/>
                <span>Cartão</span>
              </label>

              <label className="payment-card">
                <input type="radio" name="payment"/>
                <span>Dinheiro</span>
              </label>

            </div>

          </div>


          {/* RESUMO DO PEDIDO */}
          <div className="checkout-summary">

            <h2>Resumo do Pedido</h2>

            <div className="product">
              <span>2x Heineken</span>
              <span>R$ 17,00</span>
            </div>

            <div className="product">
              <span>1x Red Bull</span>
              <span>R$ 12,00</span>
            </div>

            <div className="product">
              <span>1x Jack Daniels</span>
              <span>R$ 120,00</span>
            </div>

            <div className="divider"></div>

            <div className="summary-line">
              <span>Entrega</span>
              <span>R$ 5,00</span>
            </div>

            <div className="summary-total">
              <span>Total</span>
              <span>R$ 154,00</span>
            </div>

            <button className="finish-order">
              Finalizar Pedido
            </button>

          </div>

        </div>

      </div>

    </div>
  );
}