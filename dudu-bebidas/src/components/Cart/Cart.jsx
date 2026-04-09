import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Plus, Minus, Trash2, ShoppingBag, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import "./Cart.css";

// ── Bairros com frete ──────────────────────────────────
const BAIRROS = [
  { nome: "Minas Caixas",    frete: 5.00 },
  { nome: "Serra Verde",     frete: 7.00 },
  { nome: "Parque São Pedro", frete: 7.00 },
  { nome: "Venda Nova",      frete: 7.00 },
];

export default function Cart({
  isOpen,
  onClose,
  cartItems,
  updateQuantity,
  removeItem,
  clearCart,
}) {
  const navigate = useNavigate();

  // ── Estado do bairro selecionado ───────────────────
  const [bairroSelecionado, setBairroSelecionado] = useState(null);
  const [isBairroOpen, setIsBairroOpen] = useState(false);
  const dropdownRef = useRef(null);
  const headerRef = useRef(null);

  // ── Cálculo de totais ──────────────────────────────
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.preco * item.quantity,
    0
  );

  const frete = bairroSelecionado ? bairroSelecionado.frete : null;
  const total  = frete !== null ? subtotal + frete : subtotal;

  // ── Fechar dropdown ao clicar fora ─────────────────
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsBairroOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Handlers do dropdown ───────────────────────────
  const toggleBairroDropdown = () => {
    setIsBairroOpen(!isBairroOpen);
  };

  const handleSelectBairro = (bairro) => {
    setBairroSelecionado(bairro);
    setIsBairroOpen(false);
  };

  // ── Checkout ───────────────────────────────────────
  const handleCheckout = () => {
    if (cartItems.length === 0) return;
    if (!bairroSelecionado) {
      alert("Por favor, selecione seu bairro para continuar.");
      return;
    }
    onClose();
    navigate("/checkout", {
      state: {
        cartItems: cartItems.map((item) => ({
          id:       item.id,
          name:     item.nome,
          price:    item.preco,
          quantity: item.quantity,
          icon:     item.imagem,
        })),
        cartTotal:  subtotal,
        frete:      frete,
        bairro:     bairroSelecionado.nome,
      },
    });
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`cart-overlay ${isOpen ? "show" : ""}`}
        onClick={onClose}
      />

      {/* Cart Drawer */}
      <div className={`cart-drawer ${isOpen ? "open" : ""}`}>

        {/* Header */}
        <div className="cart-header">
          <div className="cart-header-content">
            <div className="cart-icon-wrapper">
              <ShoppingBag size={24} color="#000" />
            </div>
            <div className="cart-title-wrapper">
              <h3>Meu Carrinho</h3>
              <span className="cart-item-count">
                {cartItems.length} {cartItems.length === 1 ? "item" : "itens"}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="cart-close-btn">
            <X size={24} color="#000" />
          </button>
        </div>

        {/* Cart Body */}
        <div className="cart-body">
          {cartItems.length === 0 ? (
            <div className="cart-empty">
              <ShoppingBag
                size={64}
                color="#d1d5db"
                strokeWidth={1.5}
                className="cart-empty-icon"
              />
              <h4>Carrinho vazio</h4>
              <p>Adicione produtos para começar suas compras</p>
            </div>
          ) : (
            <div className="cart-items-wrapper">
              {cartItems.map((item) => (
                <div key={item.id} className="cart-item">
                  <img
                    src={item.imagem}
                    alt={item.nome}
                    className="cart-item-image"
                  />
                  <div className="cart-item-details">
                    <h4 className="cart-item-name">{item.nome}</h4>
                    <div className="cart-item-price-row">
                      <span className="cart-item-price">
                        R$ {item.preco.toFixed(2)}
                      </span>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="cart-item-remove"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <div className="quantity-controls">
                      <button
                        onClick={() =>
                          updateQuantity(item.id, Math.max(1, item.quantity - 1))
                        }
                        className="quantity-btn"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="quantity-value">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="quantity-btn"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {cartItems.length > 0 && (
                <button onClick={clearCart} className="clear-cart-btn">
                  <Trash2 size={16} />
                  Limpar Carrinho
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {cartItems.length > 0 && (
          <div className="cart-footer">

            {/* ── Seleção de bairro com DROPDOWN ── */}
            <div className="bairro-dropdown-container" ref={dropdownRef}>
              <div 
                className={`bairro-dropdown-header ${isBairroOpen ? "open" : ""}`}
                onClick={toggleBairroDropdown}
                ref={headerRef}
              >
                <div className="bairro-dropdown-label">
                  <MapPin size={16} />
                  <span>{bairroSelecionado ? bairroSelecionado.nome : "Selecione seu bairro"}</span>
                </div>
                {isBairroOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>

              {isBairroOpen && (
                <div className="bairro-dropdown-menu">
                  {BAIRROS.map((b) => (
                    <button
                      key={b.nome}
                      className={`bairro-dropdown-item ${bairroSelecionado?.nome === b.nome ? "selected" : ""}`}
                      onClick={() => handleSelectBairro(b)}
                    >
                      <div className="bairro-item-info">
                        <span className="bairro-item-nome">{b.nome}</span>
                        <span className="bairro-item-frete">R$ {b.frete.toFixed(2)}</span>
                      </div>
                      {bairroSelecionado?.nome === b.nome && (
                        <span className="bairro-item-check">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Resumo */}
            <div className="summary-section">
              <div className="summary-row">
                <span>Subtotal:</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>

              <div className={`summary-row ${frete === 0 ? "free-shipping" : ""}`}>
                <span>Frete:</span>
                <span>
                  {frete === null
                    ? <span className="frete-pendente">Selecione o bairro</span>
                    : frete === 0
                    ? "GRÁTIS"
                    : `R$ ${frete.toFixed(2)}`}
                </span>
              </div>

              <div className="summary-total">
                <span className="total-label">Total:</span>
                <span className="total-value">
                  {frete === null
                    ? `R$ ${subtotal.toFixed(2)}`
                    : `R$ ${total.toFixed(2)}`}
                </span>
              </div>
            </div>

            {/* Checkout Button */}
            <button
              onClick={handleCheckout}
              className={`checkout-btn ${!bairroSelecionado ? "checkout-btn-disabled" : ""}`}
              disabled={!bairroSelecionado}
            >
              {bairroSelecionado ? "Finalizar Pedido" : "Selecione o bairro →"}
            </button>

          </div>
        )}
      </div>
    </>
  );
}