import React, { useState } from "react";
import { Plus, Check } from "lucide-react";

export default function ProductCard({ produto, index, addToCart }) {
  const [isAdded, setIsAdded] = useState(false);

  const handleAddToCart = () => {
    addToCart(produto);
    setIsAdded(true);

    // Reset após 2 segundos
    setTimeout(() => {
      setIsAdded(false);
    }, 2000);
  };

  return (
    <>
      {/* Product Card Container */}
      <div className="col">
        <div className="produto-card">
          <div className="produto-img-container">
            <img
              src={produto.imagem}
              alt={produto.nome}
              className="produto-img"
            />
            {/* Promo badge */}
            {produto.promocao && (
              <span className="badge-promo">
                <i className="bi bi-lightning-charge-fill me-1"></i>
                OFERTA
              </span>
            )}
            {/* Estoque count badge */}
            {produto.estoque < 15 && (
              <span className={`badge-estoque ${produto.estoque < 15 ? "baixo" : ""}`}>
                <i className="bi bi-exclamation-circle-fill me-1"></i>
                Últimas unidades
              </span>
            )}
          </div>
          
          {/* info to products */}
          <div className="produto-info">
            <h3 className="produto-nome">{produto.nome}</h3>
            
            {/* Preço section */}
            <div className="mb-3">
              <div className="d-flex align-items-baseline gap-2 mb-1">
                <span className="preco-atual">
                  R$ {produto.preco.toFixed(2)}
                </span>
              </div>
              {produto.precoAntigo && (
                <div className="d-flex align-items-center gap-2">
                  <span className="preco-antigo">
                    R$ {produto.precoAntigo.toFixed(2)}
                  </span>
                  <span className="badge badge-desconto">
                    -{produto.desconto}% OFF
                  </span>
                </div>
              )}
            </div>
            
            {/* Button to add cart */}
            <button
              onClick={handleAddToCart}
              className={`btn-add-cart ${isAdded ? "added" : ""}`}
              disabled={isAdded}
            >
              {isAdded ? (
                <>
                  <Check size={18} strokeWidth={3} />
                  Adicionado!
                </>
              ) : (
                <>
                  <Plus size={18} strokeWidth={3} />
                  Adicionar
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification to add cart */}
      {isAdded && (
        <div className="cart-notification-toast show">
          <div className="notification-content">
            <Check size={20} strokeWidth={3} />
            <span>Produto adicionado ao carrinho!</span>
          </div>
        </div>
      )}
    </>
  );
}