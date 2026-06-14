// Utils e constantes compartilhadas pelo painel admin
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
export const PAGE_SIZE = 20;

export const STATUS_PICKUP = {
  pending: {
    label: "Aguardando",
    icon: "🕐",
    color: "#ffd000",
    next: "delivered",
  },
  delivered: { label: "Entregue", icon: "✅", color: "#50c878", next: null },
};

export const STATUS_DELIVERY = {
  pending: {
    label: "Aguardando",
    icon: "🕐",
    color: "#ffd000",
    next: "preparing",
  },
  preparing: {
    label: "Preparando",
    icon: "👨‍🍳",
    color: "#ff8c00",
    next: "on_the_way",
  },
  on_the_way: {
    label: "Em entrega",
    icon: "🛵",
    color: "#50c878",
    next: "delivered",
  },
  delivered: { label: "Entregue", icon: "✅", color: "#aaa", next: null },
};

export const DELIVERY_STATUS_ORDER = [
  "pending",
  "preparing",
  "on_the_way",
  "delivered",
];
export const PICKUP_STATUS_ORDER = ["pending", "delivered"];

export const PAYMENT_LABEL = {
  pix: { icon: "⚡", label: "PIX" },
  card: { icon: "💳", label: "Cartão" },
  cash: { icon: "💵", label: "Dinheiro" },
};

export const CATEGORIES = [
  "cerveja",
  "vinho",
  "destilado",
  "refrigerante",
  "energetico",
  "outros",
];

export const EMPTY_PRODUCT = {
  id: "",
  name: "",
  category: "cerveja",
  price: "",
  old_price: "",
  image: "",
  stock: "",
  is_active: true,
  promotion: false,
  supplier: "",
  ean: "",
};

export const isPickup = (order) => order.address?.isRetirada === true;
export const getStatusMap = (order) =>
  isPickup(order) ? STATUS_PICKUP : STATUS_DELIVERY;
export const getConfig = (order) =>
  getStatusMap(order)[order.status] ?? STATUS_DELIVERY.pending;
export const getStatuses = (order) =>
  isPickup(order) ? PICKUP_STATUS_ORDER : DELIVERY_STATUS_ORDER;
export const getNext = (order) => getConfig(order).next;

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export const formatBRL = (value) =>
  `R$ ${Number(value).toFixed(2).replace(".", ",")}`;

export const calcDiscount = (oldPrice, newPrice) =>
  oldPrice > 0 ? Math.round((1 - newPrice / oldPrice) * 100) : null;

export const shouldRemoveOrder = (order) => {
  if (order.status !== "delivered") return false;
  const createdTime = new Date(order.created_at).getTime();
  const now = Date.now();
  const hoursPassed = (now - createdTime) / (1000 * 60 * 60);
  return hoursPassed >= 24;
};

// Virtual list hook (mantive aqui para simplicidade)
const GAP = 10;
export function useVariableVirtualList(
  count,
  estimatedItemHeight = 90,
  overscan = 3,
) {
  const containerRef = useRef(null);
  const [heights, setHeights] = useState({});
  const observersRef = useRef({});
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(700);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setViewH(e.contentRect.height));
    const onScroll = () => setScrollTop(el.scrollTop);
    ro.observe(el);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  const { offsets, totalHeight } = useMemo(() => {
    const nextOffsets = [];
    let acc = 0;
    for (let i = 0; i < count; i++) {
      nextOffsets.push(acc);
      acc += (heights[i] ?? estimatedItemHeight) + GAP;
    }
    return { offsets: nextOffsets, totalHeight: acc };
  }, [count, estimatedItemHeight, heights]);

  const threshold = overscan * estimatedItemHeight;
  let start = 0;
  while (start < count - 1 && offsets[start + 1] <= scrollTop - threshold)
    start++;
  let end = start;
  while (end < count - 1 && offsets[end] <= scrollTop + viewH + threshold)
    end++;

  const measureRef = useCallback(
    (index) => (el) => {
      observersRef.current[index]?.disconnect();
      delete observersRef.current[index];
      if (!el) return;
      const ro = new ResizeObserver(([e]) => {
        const h = Math.round(e.contentRect.height);
        setHeights((prev) => (prev[index] === h ? prev : { ...prev, [index]: h }));
      });
      ro.observe(el);
      observersRef.current[index] = ro;
    },
    [],
  );

  useEffect(() => {
    const obs = observersRef.current;
    return () => Object.values(obs).forEach((ro) => ro.disconnect());
  }, []);

  return { containerRef, totalHeight, offsets, start, end, measureRef };
}

// Som de notificação
let notificationAudio = null;
export function playNotificationSound() {
  try {
    if (!notificationAudio) {
      notificationAudio = new Audio("/notification.mp3");
      notificationAudio.volume = 1;
    }
    notificationAudio.currentTime = 0;
    notificationAudio.play().catch(() => {});
  } catch (error) {
    console.warn("Não foi possível tocar a notificação.", error);
  }
}
