import { useEffect, useRef, useState } from "react";

// Menu "⋮" com as ações do produto — substitui 4 botões lado a lado
// (que quebravam em telas pequenas, cortando texto) por um só botão
// compacto, do mesmo tamanho não importa a largura da janela.
export default function ProductActionsMenu({ product, onEdit, onPurchase, onToggleActive, onDelete, toggling }) {
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

  const runAndClose = (fn) => {
    setOpen(false);
    fn();
  };

  return (
    <div className="pdv-actions-menu" ref={menuRef}>
      <button type="button" className="pdv-actions-menu-btn" onClick={() => setOpen((v) => !v)} title="Ações">
        ⋮
      </button>
      {open && (
        <div className="pdv-actions-menu-list">
          <button onClick={() => runAndClose(() => onEdit(product))}>✏️ Editar</button>
          <button onClick={() => runAndClose(() => onPurchase(product))}>📦 Comprar</button>
          <button onClick={() => runAndClose(() => onToggleActive(product))} disabled={toggling}>
            {toggling ? "..." : product.is_active ? "🚫 Desativar" : "✅ Ativar"}
          </button>
          <button className="pdv-actions-menu-danger" onClick={() => runAndClose(() => onDelete(product))}>
            🗑️ Excluir
          </button>
        </div>
      )}
    </div>
  );
}
