import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./LastOrderBanner.css";

// Por quanto tempo depois da compra o aviso continua aparecendo.
const VISIBLE_HOURS = 48;

// Páginas onde não faz sentido mostrar o aviso (já está lá, ou está no
// meio de outra tarefa).
const HIDDEN_ON = ["/confirmacao", "/checkout", "/admin"];

function readLastOrder() {
  try {
    const saved = localStorage.getItem("lastOrder");
    if (!saved) return null;

    const order = JSON.parse(saved);
    if (!order?.orderId || !order?.savedAt) return null;

    const hoursPassed = (Date.now() - new Date(order.savedAt).getTime()) / 36e5;
    if (hoursPassed >= VISIBLE_HOURS) return null;

    if (localStorage.getItem(`lastOrderDismissed:${order.orderId}`)) return null;

    return order;
  } catch {
    return null;
  }
}

export default function LastOrderBanner() {
  const location = useLocation();
  const navigate = useNavigate();
  const [order, setOrder] = useState(readLastOrder);

  // Reconfere sempre que o usuário navega (ex: acabou de finalizar uma
  // compra em outra aba, ou voltou pro site depois de um tempo).
  useEffect(() => {
    setOrder(readLastOrder());
  }, [location.pathname]);

  if (!order || HIDDEN_ON.includes(location.pathname)) return null;

  const shortId = order.orderId.slice(-8).toUpperCase();

  const handleDismiss = (e) => {
    e.stopPropagation();
    localStorage.setItem(`lastOrderDismissed:${order.orderId}`, "1");
    setOrder(null);
  };

  return (
    <button
      className="lob-banner"
      onClick={() => navigate("/confirmacao")}
      aria-label={`Acompanhar pedido #${shortId}`}
    >
      <span className="lob-icon">📦</span>
      <span className="lob-text">
        Você tem um pedido em andamento
        <span className="lob-subtext">#{shortId} · toque para acompanhar</span>
      </span>
      <span className="lob-close" onClick={handleDismiss} aria-label="Dispensar">
        ✕
      </span>
    </button>
  );
}