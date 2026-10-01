import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Menu "⋮" genérico pra células de ação de tabela — usado em Produtos e
// Contas a Pagar (qualquer lista com várias ações por linha). Um botão só,
// tamanho fixo não importa a largura da tela — os botões lado a lado
// quebravam/cortavam em janelas pequenas (largura variava com a
// quantidade de botões, sem jeito confiável de acompanhar toda tela).
// Fecha sozinho ao clicar em qualquer ação dentro (bubbling) ou fora dele.
export default function ActionsMenu({ children }) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const menuRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Linha perto do fim da tabela/tela: abrir sempre pra baixo cortava as
  // últimas opções do menu (geralmente "Desativar"/"Excluir", as mais
  // importantes de ver). Mede o espaço disponível ANTES de pintar na tela
  // (useLayoutEffect, não useEffect) pra já nascer na direção certa, sem
  // o usuário ver o menu "pular" de lugar.
  useLayoutEffect(() => {
    if (!open || !menuRef.current || !listRef.current) return;
    const buttonRect = menuRef.current.getBoundingClientRect();
    const menuHeight = listRef.current.offsetHeight;
    const spaceBelow = window.innerHeight - buttonRect.bottom;
    setOpenUpward(spaceBelow < menuHeight + 12);
  }, [open]);

  return (
    <div className="pdv-actions-menu" ref={menuRef}>
      <button type="button" className="pdv-actions-menu-btn" onClick={() => setOpen((v) => !v)} title="Ações">
        ⋮
      </button>
      {open && (
        <div
          ref={listRef}
          className={`pdv-actions-menu-list ${openUpward ? "pdv-actions-menu-list-up" : ""}`}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}
