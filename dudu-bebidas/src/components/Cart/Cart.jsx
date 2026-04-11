import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Plus, Minus, Trash2, ShoppingBag, MapPin, ChevronDown, ChevronUp, Clock, Store } from "lucide-react";
import "./Cart.css";

// ── Opções de entrega / retirada ───────────────────────
const BAIRROS = [
  { nome: "Retirada na Loja", frete: 0, isRetirada: true },
  { nome: "Minas Caixas",     frete: 3.00 },
  { nome: "Serra Verde",      frete: 5.00 },
  { nome: "Parque São Pedro", frete: 3.00 },
  { nome: "Venda Nova",       frete: 5.00 },
];

// ── Horários de funcionamento ──────────────────────────
const HORARIO_ENTREGA  = { abertura: 9 * 60,        fechamento: 17 * 60 + 30 }; // 09:00 – 17:30
const HORARIO_RETIRADA = { abertura: 9 * 60,        fechamento: 19 * 60      }; // 09:00 – 19:00

function getMinutosAgora() {
  const agora = new Date();
  return agora.getHours() * 60 + agora.getMinutes();
}

function verificarHorario(isRetirada) {
  const minutos = getMinutosAgora();
  const horario = isRetirada ? HORARIO_RETIRADA : HORARIO_ENTREGA;

  if (minutos < horario.abertura) {
    const h = Math.floor(horario.abertura / 60).toString().padStart(2, "0");
    const m = (horario.abertura % 60).toString().padStart(2, "0");
    return {
      disponivel: false,
      mensagem: `Ainda não abrimos. ${isRetirada ? "Retirada" : "Entrega"} disponível a partir das ${h}h${m}.`,
    };
  }

  if (minutos >= horario.fechamento) {
    const h = Math.floor(horario.abertura / 60).toString().padStart(2, "0");
    const m = (horario.abertura % 60).toString().padStart(2, "0");
    return {
      disponivel: false,
      mensagem: `Fora do horário. ${isRetirada ? "Retirada" : "Entrega"} retoma amanhã às ${h}h${m}.`,
    };
  }

  return { disponivel: true, mensagem: null };
}

function formatarHorario(minutos) {
  const h = Math.floor(minutos / 60).toString().padStart(2, "0");
  const m = (minutos % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export default function Cart({
  isOpen,
  onClose,
  cartItems,
  updateQuantity,
  removeItem,
  clearCart,
}) {
  const navigate = useNavigate();

  const [bairroSelecionado, setBairroSelecionado] = useState(null);
  const [isBairroOpen, setIsBairroOpen]           = useState(false);
  const [horarioAviso, setHorarioAviso]           = useState(null);
  const dropdownRef = useRef(null);

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.preco * item.quantity,
    0
  );

  const frete = bairroSelecionado ? bairroSelecionado.frete : null;
  const total  = frete !== null ? subtotal + frete : subtotal;

  // ── Fechar dropdown ao clicar fora ─────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsBairroOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ── Limpa aviso ao trocar seleção ──────────────────
  useEffect(() => {
    setHorarioAviso(null);
  }, [bairroSelecionado]);

  const toggleBairroDropdown = () => setIsBairroOpen((v) => !v);

  const handleSelectBairro = (bairro) => {
    setBairroSelecionado(bairro);
    setIsBairroOpen(false);
  };

  // ── Checkout com validação de horário ──────────────
  const handleCheckout = () => {
    if (cartItems.length === 0) return;

    if (!bairroSelecionado) {
      alert("Por favor, selecione seu bairro ou retirada para continuar.");
      return;
    }

    const { disponivel, mensagem } = verificarHorario(bairroSelecionado.isRetirada ?? false);

    if (!disponivel) {
      setHorarioAviso(mensagem);
      return;
    }

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
        isRetirada: bairroSelecionado.isRetirada ?? false,
      },
    });

    setTimeout(() => onClose(), 300);
  };

  return (
    <>
      {/* Overlay */}
      <div className={`cart-overlay ${isOpen ? "show" : ""}`} onClick={onClose} />

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
              <ShoppingBag size={64} color="#d1d5db" strokeWidth={1.5} className="cart-empty-icon" />
              <h4>Carrinho vazio</h4>
              <p>Adicione produtos para começar suas compras</p>
            </div>
          ) : (
            <div className="cart-items-wrapper">
              {cartItems.map((item) => (
                <div key={item.id} className="cart-item">
                  <img src={item.imagem} alt={item.nome} className="cart-item-image" />
                  <div className="cart-item-details">
                    <h4 className="cart-item-name">{item.nome}</h4>
                    <div className="cart-item-price-row">
                      <span className="cart-item-price">R$ {item.preco.toFixed(2)}</span>
                      <button onClick={() => removeItem(item.id)} className="cart-item-remove">
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <div className="quantity-controls">
                      <button
                        onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
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

            {/* ── Horários de funcionamento ── */}
            <div className="horarios-info">
              <div className="horario-row">
                <MapPin size={13} />
                <span>Entrega: {formatarHorario(HORARIO_ENTREGA.abertura)} – {formatarHorario(HORARIO_ENTREGA.fechamento)}</span>
              </div>
              <div className="horario-row">
                <Store size={13} />
                <span>Retirada: {formatarHorario(HORARIO_RETIRADA.abertura)} – {formatarHorario(HORARIO_RETIRADA.fechamento)}</span>
              </div>
            </div>

            {/* ── Aviso de horário fora do expediente ── */}
            {horarioAviso && (
              <div className="horario-aviso">
                <Clock size={15} />
                <span>{horarioAviso}</span>
              </div>
            )}

            {/* ── Dropdown de bairro / retirada ── */}
            <div className="bairro-dropdown-container" ref={dropdownRef}>
              <div
                className={`bairro-dropdown-header ${isBairroOpen ? "open" : ""}`}
                onClick={toggleBairroDropdown}
              >
                <div className="bairro-dropdown-label">
                  {bairroSelecionado?.isRetirada
                    ? <Store size={16} />
                    : <MapPin size={16} />
                  }
                  <span>
                    {bairroSelecionado ? bairroSelecionado.nome : "Selecione entrega ou retirada"}
                  </span>
                </div>
                {isBairroOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>

              {isBairroOpen && (
                <div className="bairro-dropdown-menu">
                  {BAIRROS.map((b) => (
                    <button
                      key={b.nome}
                      className={`bairro-dropdown-item ${bairroSelecionado?.nome === b.nome ? "selected" : ""} ${b.isRetirada ? "item-retirada" : ""}`}
                      onClick={() => handleSelectBairro(b)}
                    >
                      <div className="bairro-item-left">
                        {b.isRetirada
                          ? <Store size={14} className="bairro-item-icon retirada-icon" />
                          : <MapPin size={14} className="bairro-item-icon" />
                        }
                        <div className="bairro-item-info">
                          <span className="bairro-item-nome">{b.nome}</span>
                          <span className={`bairro-item-frete ${b.frete === 0 ? "gratis" : ""}`}>
                            {b.frete === 0 ? "GRÁTIS" : `R$ ${b.frete.toFixed(2)}`}
                          </span>
                        </div>
                      </div>
                      {bairroSelecionado?.nome === b.nome && (
                        <span className="bairro-item-check">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Resumo ── */}
            <div className="summary-section">
              <div className="summary-row">
                <span>Subtotal:</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>

              <div className={`summary-row ${frete === 0 ? "free-shipping" : ""}`}>
                <span>Frete:</span>
                <span>
                  {frete === null
                    ? <span className="frete-pendente">Selecione a opção</span>
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

            {/* ── Botão de checkout ── */}
            <button
              onClick={handleCheckout}
              className={`checkout-btn ${!bairroSelecionado ? "checkout-btn-disabled" : ""}`}
              disabled={!bairroSelecionado}
            >
              {bairroSelecionado ? "Finalizar Pedido" : "Selecione a opção →"}
            </button>

          </div>
        )}
      </div>
    </>
  );
}