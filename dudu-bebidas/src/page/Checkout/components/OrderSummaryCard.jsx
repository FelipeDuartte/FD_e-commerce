import { imgProduto } from "../../../utils/Cloudnary";
import ConfirmCta from "./ConfirmCta";

export default function OrderSummaryCard({
  cartItems, cartTotal, DELIVERY, isRetirada, payment, cardFee, installments,
  finalTotal, ctaLabel, onConfirm, isDisabled, closed, hideConfirmButton,
}) {
  return (
    <div className="co-summary">
      <div className="co-summary-title">Resumo</div>

      <div className="co-items">
        {cartItems.length === 0 ? (
          <p className="co-empty-msg">Nenhum item no carrinho.</p>
        ) : (
          cartItems.map((item, i) => (
            <div className="co-item" key={i}>
              <div className="co-item-icon">
                {item.icon ? (
                  <img
                    src={imgProduto(item.icon)}
                    alt={item.name}
                    style={{
                      width: 36,
                      height: 36,
                      objectFit: "cover",
                      borderRadius: 6,
                    }}
                  />
                ) : (
                  "🛒"
                )}
              </div>
              <div className="co-item-info">
                <div className="co-item-name">{item.name}</div>
                <div className="co-item-qty">{item.quantity} unidade(s)</div>
              </div>
              <div className="co-item-price">
                R$ {(item.price * item.quantity).toFixed(2).replace(".", ",")}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="co-summary-rows">
        <div className="co-summary-row">
          <span>Subtotal</span>
          <span>R$ {cartTotal.toFixed(2).replace(".", ",")}</span>
        </div>
        <div className="co-summary-row">
          <span>{isRetirada ? "Retirada" : "Entrega"}</span>
          <span>
            {DELIVERY === 0 ? "GRÁTIS" : `R$ ${DELIVERY.toFixed(2).replace(".", ",")}`}
          </span>
        </div>
        {payment === "credit_card" && cardFee > 0 && (
          <div className="co-summary-row co-summary-row-fee">
            <span>Taxa da maquininha ({installments}x)</span>
            <span>+ R$ {cardFee.toFixed(2).replace(".", ",")}</span>
          </div>
        )}
      </div>

      <div className="co-total-row">
        <span className="co-total-label">Total</span>
        <span className="co-total-value">R$ {finalTotal.toFixed(2).replace(".", ",")}</span>
      </div>

      {hideConfirmButton ? (
        <p className="co-mp-cta-hint">↑ Preencha os dados do cartão para finalizar</p>
      ) : (
        <ConfirmCta label={ctaLabel} onClick={onConfirm} disabled={isDisabled || closed} />
      )}
    </div>
  );
}
