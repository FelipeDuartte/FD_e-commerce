// src/components/ProductCard/ProductCard.jsx
import React, { useEffect, useState } from "react";
import { Plus, Check, X } from "lucide-react";
import { imgProduto } from "../../utils/Cloudnary";
import "./ProductCard.css";

const RESET_TIME = 2000;

export default function ProductCard({ produto, addToCart }) {
  const [isAdded, setIsAdded] = useState(false);

  const hasPromo = Boolean(produto.promocao);
  const hasOldPrice = hasPromo && Boolean(produto.precoAntigo);
  const isLowStock = produto.estoque > 0 && produto.estoque < 15;
  const isOutOfStock = produto.estoque <= 0 || produto.isActive === false;

  const handleAddToCart = () => {
    if (isAdded || isOutOfStock) return;
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
        <div
          className={`produto-card ${isOutOfStock ? "produto-card-esgotado" : ""}`}
        >
          {/* Imagem */}
          <div className="produto-img-container">
            <img
              src={imgProduto(produto.imagem)}
              alt={produto.nome}
              className={`produto-img ${isOutOfStock ? "img-esgotado" : ""}`}
              loading="lazy"
            />

            {hasPromo && !isOutOfStock && (
              <span className="badge-promo">
                <i className="bi bi-lightning-charge-fill me-1"></i>
                OFERTA
              </span>
            )}

            {isOutOfStock ? (
              <span className="badge-estoque esgotado">
                <i className="bi bi-x-circle-fill me-1"></i>
                Esgotado
              </span>
            ) : (
              isLowStock && (
                <span className="badge-estoque baixo">
                  <i className="bi bi-exclamation-circle-fill me-1"></i>
                  Últimas unidades
                </span>
              )
            )}
          </div>

          {/* Info */}
          <div className="produto-info">
            <h3 className="produto-nome">{produto.nome}</h3>

            {/* Preços */}
            <div className="mb-2">
              {hasPromo && hasOldPrice ? (
                // Produto em promoção: mostra preço antigo riscado + novo em destaque
                <>
                  <div className="d-flex align-items-baseline gap-2 mb-1">
                    <span className="preco-atual preco-promo">
                      R$ {produto.preco.toFixed(2)}
                    </span>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <span className="preco-antigo">
                      R$ {produto.precoAntigo.toFixed(2)}
                    </span>
                    {produto.desconto && (
                      <span className="badge-desconto">
                        -{produto.desconto}% OFF
                      </span>
                    )}
                  </div>
                </>
              ) : (
                // Produto normal: só o preço atual
                <div className="d-flex align-items-baseline gap-2 mb-1">
                  <span className="preco-atual">
                    R$ {produto.preco.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* Botão */}
            <button
              onClick={handleAddToCart}
              className={`btn-add-cart ${isAdded ? "added" : ""} ${isOutOfStock ? "esgotado" : ""}`}
              disabled={isAdded || isOutOfStock}
            >
              {isOutOfStock ? (
                <>
                  <X size={16} strokeWidth={3} />
                  Esgotado
                </>
              ) : isAdded ? (
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
