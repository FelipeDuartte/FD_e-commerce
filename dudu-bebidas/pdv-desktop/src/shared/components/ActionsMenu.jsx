import { useEffect, useRef, useState } from "react";

// Menu "⋮" genérico pra células de ação de tabela — usado em Produtos e
// Contas a Pagar (qualquer lista com várias ações por linha). Um botão só,
// tamanho fixo não importa a largura da tela — os botões lado a lado
// quebravam/cortavam em janelas pequenas (largura variava com a
// quantidade de botões, sem jeito confiável de acompanhar toda tela).
// Fecha sozinho ao clicar em qualquer ação dentro (bubbling) ou fora dele.
export default function ActionsMenu({ children }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="pdv-actions-menu" ref={menuRef}>
      <button type="button" className="pdv-actions-menu-btn" onClick={() => setOpen((v) => !v)} title="Ações">
        ⋮
      </button>
      {open && (
        <div className="pdv-actions-menu-list" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}
