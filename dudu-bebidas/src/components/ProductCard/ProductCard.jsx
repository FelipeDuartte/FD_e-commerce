import React, { useEffect, useState } from "react";
import { Plus, Check } from "lucide-react";
import "./ProductCard.css";

const RESET_TIME = 2000;

export default function ProductCard({ produto, addToCart }) {
  const [isAdded, setIsAdded] = useState(false);

  const hasPromo    = Boolean(produto.promocao);
  const hasOldPrice = hasPromo && Boolean(produto.precoAntigo);
  const isLowStock  = produto.estoque < 15;

  const handleAddToCart = () => {
    if (isAdded) return;
    addToCart(produto);
    setIsAdded(true);
  };

  useEffect(() => {
    if (!isAdded) return;
    const timer = setTimeout(() => setIsAdded(false), RESET_TIME);
    return () => clearTimeout(timer);
  }, [isAdded]);

  return (
    <>
      {/* Product Card */}
      <div className="col">
        <div className="produto-card">

          {/* Imagem */}
          <div className="produto-img-container">
            <img
              src={produto.imagem}
              alt={produto.nome}
              className="produto-img"
            />

            {hasPromo && (
              <span className="badge-promo">
                <i className="bi bi-lightning-charge-fill me-1"></i>
                OFERTA
              </span>
            )}

            {isLowStock && (
              <span className="badge-estoque baixo">
                <i className="bi bi-exclamation-circle-fill me-1"></i>
                Últimas unidades
              </span>
            )}
          </div>

          {/* Info */}
          <div className="produto-info">
            <h3 className="produto-nome">{produto.nome}</h3>

            {/* Preços */}
            <div className="mb-2">
              <div className="d-flex align-items-baseline gap-2 mb-1">
                <span className="preco-atual">
                  R$ {produto.preco.toFixed(2)}
                </span>
              </div>

              {hasOldPrice && (
                <div className="d-flex align-items-center gap-2">
                  <span className="preco-antigo">
                    R$ {produto.precoAntigo.toFixed(2)}
                  </span>
                  <span className="badge-desconto">
                    -{produto.desconto}% OFF
                  </span>
                </div>
              )}
            </div>

            {/* Botão */}
            <button
              onClick={handleAddToCart}
              className={`btn-add-cart ${isAdded ? "added" : ""}`}
              disabled={isAdded}
            >
              {isAdded ? (
                <>
                  <Check size={16} strokeWidth={3} />
                  Adicionado!
                </>
              ) : (
                <>
                  <Plus size={16} strokeWidth={3} />
                  Adicionar
                </>
              )}
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