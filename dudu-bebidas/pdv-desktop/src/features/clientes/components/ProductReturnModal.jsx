import { useMemo, useState } from "react";
import { useLiveProducts } from "../../../shared/hooks/useLiveProducts";

const MAX_RESULTS = 30;

// Devolução de produto comprado fora do fiado (ex: pago no balcão) — já está
// pago, então sempre vira crédito. Lista todos os produtos, inclusive
// zerados/inativos: o que está voltando pode ser justamente o que acabou.
export default function ProductReturnModal({ customer, onConfirm, onDismiss }) {
  const { products, loading } = useLiveProducts();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [qtyInput, setQtyInput] = useState("1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(term) || p.id.toLowerCase().includes(term) || (p.ean ?? "") === term)
      .slice(0, MAX_RESULTS);
  }, [products, search]);

  const handleConfirm = async () => {
    const qty = Number(qtyInput);
    if (!selected) {
      setError("Escolha o produto devolvido.");
      return;
    }
    if (!Number.isInteger(qty) || qty < 1) {
      setError("Informe uma quantidade válida.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onConfirm({ productId: selected.id, quantity: qty });
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <>
      <div className="adm-modal-overlay" onClick={() => !saving && onDismiss()} />
      <div className="adm-modal pdv-credit-modal" role="dialog" aria-modal="true">
        <h2 className="adm-store-section-title">Registrar devolução — {customer.name}</h2>
        <p className="adm-store-section-desc">
          Pra produto comprado e já pago fora de um pedido em aberto. Devolução de item de pedido em aberto
          é pelo botão ↩️ no próprio pedido.
        </p>

        {error && <div className="adm-modal-error">⚠️ {error}</div>}

        {selected ? (
          <div className="pdv-credit-selected">
            <strong>{selected.name}</strong>
            <button type="button" className="adm-btn-back" onClick={() => setSelected(null)} disabled={saving}>
              Trocar
            </button>
          </div>
        ) : (
          <div className="adm-form-field">
            <label>Produto devolvido</label>
            <input
              className="adm-product-search"
              placeholder={loading ? "Carregando produtos..." : "🔍 Buscar por nome ou código..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {results.length > 0 && (
              <div className="pdv-credit-results">
                {results.map((p) => (
                  <button key={p.id} type="button" className="pdv-credit-result" onClick={() => setSelected(p)}>
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="adm-form-field">
          <label>Quantidade devolvida</label>
          <input type="number" min="1" step="1" value={qtyInput} onChange={(e) => setQtyInput(e.target.value)} />
        </div>

        <div className="pdv-credit-preview pdv-credit-preview-credit">
          O produto volta pro estoque e o cliente fica com crédito dele pra retirar depois.
        </div>

        <div className="adm-store-form-actions">
          <button className="adm-btn-new-product" onClick={handleConfirm} disabled={saving}>
            {saving ? "Registrando..." : "Confirmar devolução"}
          </button>
          <button className="adm-btn-back" onClick={onDismiss} disabled={saving}>
            Cancelar
          </button>
        </div>
      </div>
    </>
  );
}
