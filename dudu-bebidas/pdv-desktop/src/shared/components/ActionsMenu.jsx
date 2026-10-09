import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const GAP = 4;
const VIEWPORT_MARGIN = 8;

// Menu "⋮" genérico pra células de ação de tabela — usado em Produtos e
// Contas a Pagar (qualquer lista com várias ações por linha). Um botão só,
// tamanho fixo não importa a largura da tela — os botões lado a lado
// quebravam/cortavam em janelas pequenas.
// A lista é renderizada no <body> com position: fixed: dentro da tabela ela
// era cortada pelo overflow do container (tabela com 1 produto ou última
// linha → só aparecia o primeiro item).
// Fecha sozinho ao clicar em qualquer ação dentro, fora dele, ou ao rolar.
export default function ActionsMenu({ children }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (buttonRef.current?.contains(e.target) || listRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  // Mede antes de pintar (useLayoutEffect) pra já nascer no lugar certo:
  // abaixo do botão, ou acima se não couber até o fim da janela.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !listRef.current) {
      setPosition(null);
      return;
    }
    const b = buttonRef.current.getBoundingClientRect();
    const menuHeight = listRef.current.offsetHeight;
    const fitsBelow = window.innerHeight - b.bottom >= menuHeight + GAP + VIEWPORT_MARGIN;
    const top = fitsBelow ? b.bottom + GAP : Math.max(VIEWPORT_MARGIN, b.top - GAP - menuHeight);
    setPosition({ top, right: Math.max(VIEWPORT_MARGIN, window.innerWidth - b.right) });
  }, [open]);

  return (
    <div className="pdv-actions-menu">
      <button
        ref={buttonRef}
        type="button"
        className="pdv-actions-menu-btn"
        onClick={() => setOpen((v) => !v)}
        title="Ações"
      >
        ⋮
      </button>
      {open &&
        createPortal(
          <div
            ref={listRef}
            className="pdv-actions-menu-list"
            style={position ? { top: position.top, right: position.right } : { visibility: "hidden" }}
            onClick={() => setOpen(false)}
          >
            {children}
          </div>,
          document.body,
        )}
    </div>
  );
}
