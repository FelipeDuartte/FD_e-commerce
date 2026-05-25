import { useEffect, useState } from "react";
import { Plus, Check, X } from "lucide-react";
import { imgProduto } from "../../utils/Cloudnary";
import "./ProductCard.css";
import { isStoreOpen } from "../../utils/storeHours";

const RESET_TIME = 2000;

const formatBRL = (value) => `R$ ${Number(value).toFixed(2)}`;

export default function ProductCard({ produto, addToCart }) {
  const [isAdded, setIsAdded] = useState(false);

  const hasPromo = Boolean(produto.promocao);
  const hasOldPrice = hasPromo && Boolean(produto.precoAntigo);
  const isLowStock = produto.estoque > 0 && produto.estoque < 15;
  const isOutOfStock = produto.estoque <= 0 || produto.isActive === false;

  const handleAddToCart = () => {
    if (!isStoreOpen()) {
      alert("Loja fechada às segundas — não é possível comprar agora.");
      return;
    }
    if (isAdded || isOutOfStock || produto.estoque <= 0) return;
    addToCart(produto);
    setIsAdded(true);
  };

  useEffect(() => {
    if (!isAdded) return;
    const timer = setTimeout(() => setIsAdded(false), RESET_TIME);
    return () => clearTimeout(timer);
  }, [isAdded]);

  // Estado do botão
  const btnState = !isStoreOpen() ? "fechado" : isOutOfStock ? "esgotado" : isAdded ? "added" : "default";

  const BTN_CONTENT = {
    esgotado: (
      <>
        <X size={16} strokeWidth={3} /> Esgotado
      </>
    ),
    added: (
      <>
        <Check size={16} strokeWidth={3} /> Adicionado!
      </>
    ),
    fechado: (
      <>
        <X size={16} strokeWidth={3} /> Fechado (segunda)
      </>
    ),
    default: (
      <>
        <Plus size={16} strokeWidth={3} /> Adicionar
      </>
    ),
  };

  return (
    <>
      <div className="col">
        <div
          className={`produto-card${isOutOfStock ? " produto-card-esgotado" : ""}`}
        >
          {/* Imagem */}
          <div className="produto-img-container">
            <img
              src={imgProduto(produto.imagem)}
              alt={produto.nome}
              className={`produto-img${isOutOfStock ? " img-esgotado" : ""}`}
              loading="lazy"
            />

            {hasPromo && !isOutOfStock && (
              <span className="badge-promo">
                <i className="bi bi-lightning-charge-fill me-1" />
                OFERTA
              </span>
            )}

            {isOutOfStock ? (
              <span className="badge-estoque esgotado">
                <i className="bi bi-x-circle-fill me-1" />
                Esgotado
              </span>
            ) : (
              isLowStock && (
                <span className="badge-estoque baixo">
                  <i className="bi bi-exclamation-circle-fill me-1" />
                  Últimas unidades
                </span>
              )
            )}
          </div>

          {/* Info */}
          <div className="produto-info">
            <h3 className="produto-nome">{produto.nome}</h3>

            {/* Preços */}
            <div className="produto-precos">
              <span
                className={`preco-atual${hasPromo && hasOldPrice ? " preco-promo" : ""}`}
              >
                {formatBRL(produto.preco)}
              </span>

              {hasPromo && hasOldPrice && (
                <div className="preco-linha-antiga">
                  <span className="preco-antigo">
                    {formatBRL(produto.precoAntigo)}
                  </span>
                  {produto.desconto && (
                    <span className="badge-desconto">
                      -{produto.desconto}% OFF
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Botão */}
            <button
              onClick={handleAddToCart}
              className={`btn-add-cart${isAdded ? " added" : ""}${isOutOfStock ? " esgotado" : ""}`}
              disabled={isAdded || isOutOfStock || !isStoreOpen()}
              title={!isStoreOpen() ? "Loja fechada às segundas" : undefined}
            >
              {BTN_CONTENT[btnState]}
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {isAdded && (
        <div className="cart-notification-toast show">
          <div className="notification-content">
            <Check size={18} strokeWidth={3} />
            <span>Produto adicionado ao carrinho!</span>
          </div>
        </div>
      )}
    </>
  );
}
