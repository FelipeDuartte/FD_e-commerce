import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  MapPin,
  ChevronDown,
  ChevronUp,
  Clock,
  Store,
} from "lucide-react";
import "./Cart.css";
import { isStoreOpen } from "../../utils/storeHours";

// ── Opções de entrega / retirada ───────────────────────
const BAIRROS = [
  { nome: "Retirada na Loja", frete: 0, isRetirada: true },
  { nome: "Minas Caixas", frete: 3.0 },
  { nome: "Serra Verde", frete: 5.0 },
  { nome: "Parque São Pedro", frete: 3.0 },
  { nome: "Venda Nova", frete: 5.0 },
];

const HORARIO_ENTREGA = { abertura: 9 * 60, fechamento: 17 * 60 + 30 };
const HORARIO_RETIRADA = { abertura: 9 * 60, fechamento: 19 * 60 };

function getMinutosAgora() {
  const agora = new Date();
  return agora.getHours() * 60 + agora.getMinutes();
}

function verificarHorario(isRetirada) {
  const minutos = getMinutosAgora();
  const horario = isRetirada ? HORARIO_RETIRADA : HORARIO_ENTREGA;
  if (minutos < horario.abertura) {
    const h = Math.floor(horario.abertura / 60)
      .toString()
      .padStart(2, "0");
    const m = (horario.abertura % 60).toString().padStart(2, "0");
    return {
      disponivel: false,
      mensagem: `Ainda não abrimos. ${isRetirada ? "Retirada" : "Entrega"} disponível a partir das ${h}h${m}.`,
    };
  }
  if (minutos >= horario.fechamento) {
    const h = Math.floor(horario.abertura / 60)
      .toString()
      .padStart(2, "0");
    const m = (horario.abertura % 60).toString().padStart(2, "0");
    return {
      disponivel: false,
      mensagem: `Fora do horário. ${isRetirada ? "Retirada" : "Entrega"} retoma amanhã às ${h}h${m}.`,
    };
  }
  return { disponivel: true, mensagem: null };
}

function formatarHorario(minutos) {
  const h = Math.floor(minutos / 60)
    .toString()
    .padStart(2, "0");
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
  user, // mantido por compatibilidade, mas não usado para bloquear o checkout
}) {
  const navigate = useNavigate();

  const [bairroSelecionado, setBairroSelecionado] = useState(null);
  const [isBairroOpen, setIsBairroOpen] = useState(false);
  const [horarioAviso, setHorarioAviso] = useState(null);
  const [avisoEstoque, setAvisoEstoque] = useState(null);
  const dropdownRef = useRef(null);

  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.preco * item.quantity,
    0,
  );
  const frete = bairroSelecionado ? bairroSelecionado.frete : null;
  const total = frete !== null ? subtotal + frete : subtotal;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsBairroOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setHorarioAviso(null);
  }, [bairroSelecionado]);

  const handleSelectBairro = (bairro) => {
    setBairroSelecionado(bairro);
    setIsBairroOpen(false);
  };

  const handleIncrementQuantity = (item) => {
    if (item.quantity >= item.estoque) {
      // Mostra aviso se atingiu o máximo de estoque
      setAvisoEstoque(item.id);
      setTimeout(() => setAvisoEstoque(null), 3000);
      return;
    }
    updateQuantity(item.id, item.quantity + 1);
  };

  const handleCheckout = () => {
    if (!isStoreOpen()) {
      setHorarioAviso("Hoje é segunda — a loja está fechada. Não é possível finalizar pedidos.");
      return;
    }
    if (cartItems.length === 0) return;
    if (!bairroSelecionado) {
      alert("Por favor, selecione seu bairro ou retirada para continuar.");
      return;
    }

    const isRetirada = bairroSelecionado.isRetirada ?? false;
    const { disponivel, mensagem } = verificarHorario(isRetirada);
    if (!disponivel) {
      setHorarioAviso(mensagem);
      return;
    }

    // ✅ Sem verificação de login — qualquer pessoa pode finalizar o pedido
    navigate("/checkout", {
      state: {
        cartItems: cartItems.map((item) => ({
          id: item.id,
          name: item.nome,
          price: item.preco,
          quantity: item.quantity,
          icon: item.imagem,
        })),
        cartTotal: subtotal,
        frete,
        bairro: bairroSelecionado.nome,
        isRetirada,
      },
    });
    setTimeout(() => onClose(), 300);
  };

  return (
    <>
      <div
        className={`cart-overlay ${isOpen ? "show" : ""}`}
        onClick={onClose}
      />

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

        {/* Body */}
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
                          updateQuantity(
                            item.id,
                            Math.max(1, item.quantity - 1),
                          )
                        }
                        className="quantity-btn"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="quantity-value">{item.quantity}</span>
                      <button
                        onClick={() => handleIncrementQuantity(item)}
                        className="quantity-btn"
                        title={
                          item.quantity >= item.estoque
                            ? `Máximo em estoque: ${item.estoque}`
                            : ""
                        }
                      >
                        <Plus size={16} />
                      </button>
                      {avisoEstoque === item.id && (
                        <span className="estoque-aviso">
                          ⚠ Limite de estoque atingido
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={clearCart} className="clear-cart-btn">
                <Trash2 size={16} /> Limpar Carrinho
              </button>
            </div>
          )}
        </div>

        {/* Footer — só aparece se tiver itens */}
        {cartItems.length > 0 && (
          <div className="cart-footer">
            {/* Horários */}
            <div className="horarios-info">
              <div className="horario-row">
                <MapPin size={13} />
                <span>
                  Entrega: {formatarHorario(HORARIO_ENTREGA.abertura)} –{" "}
                  {formatarHorario(HORARIO_ENTREGA.fechamento)}
                </span>
              </div>
              <div className="horario-row">
                <Store size={13} />
                <span>
                  Retirada: {formatarHorario(HORARIO_RETIRADA.abertura)} –{" "}
                  {formatarHorario(HORARIO_RETIRADA.fechamento)}
                </span>
              </div>
            </div>

            {horarioAviso && (
              <div className="horario-aviso">
                <Clock size={15} />
                <span>{horarioAviso}</span>
              </div>
            )}

            {/* Dropdown de bairros */}
            <div className="bairro-dropdown-container" ref={dropdownRef}>
              <div
                className={`bairro-dropdown-header ${isBairroOpen ? "open" : ""}`}
                onClick={() => setIsBairroOpen((v) => !v)}
              >
                <div className="bairro-dropdown-label">
                  {bairroSelecionado?.isRetirada ? (
                    <Store size={16} />
                  ) : (
                    <MapPin size={16} />
                  )}
                  <span>
                    {bairroSelecionado
                      ? bairroSelecionado.nome
                      : "Selecione entrega ou retirada"}
                  </span>
                </div>
                {isBairroOpen ? (
                  <ChevronUp size={18} />
                ) : (
                  <ChevronDown size={18} />
                )}
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
                        {b.isRetirada ? (
                          <Store
                            size={14}
                            className="bairro-item-icon retirada-icon"
                          />
                        ) : (
                          <MapPin size={14} className="bairro-item-icon" />
                        )}
                        <div className="bairro-item-info">
                          <span className="bairro-item-nome">{b.nome}</span>
                          <span
                            className={`bairro-item-frete ${b.frete === 0 ? "gratis" : ""}`}
                          >
                            {b.frete === 0
                              ? "GRÁTIS"
                              : `R$ ${b.frete.toFixed(2)}`}
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

            {/* Resumo */}
            <div className="summary-section">
              <div className="summary-row">
                <span>Subtotal</span>
                <span>R$ {subtotal.toFixed(2)}</span>
              </div>
              <div
                className={`summary-row ${frete === 0 ? "free-shipping" : ""}`}
              >
                <span>Frete</span>
                <span>
                  {frete === null ? (
                    <span className="frete-pendente">Selecione a opção</span>
                  ) : frete === 0 ? (
                    "GRÁTIS"
                  ) : (
                    `R$ ${frete.toFixed(2)}`
                  )}
                </span>
              </div>
              <div className="summary-total">
                <span className="total-label">Total</span>
                <span className="total-value">
                  {frete === null
                    ? `R$ ${subtotal.toFixed(2)}`
                    : `R$ ${total.toFixed(2)}`}
                </span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              className={`checkout-btn ${!bairroSelecionado ? "checkout-btn-disabled" : ""}`}
              disabled={!bairroSelecionado}
            >
              {bairroSelecionado
                ? bairroSelecionado.isRetirada
                  ? "🏪 Confirmar Retirada →"
                  : "🛒 Finalizar Pedido →"
                : "Selecione a opção →"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
