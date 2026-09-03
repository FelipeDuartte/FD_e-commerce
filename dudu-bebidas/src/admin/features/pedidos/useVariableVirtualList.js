import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
