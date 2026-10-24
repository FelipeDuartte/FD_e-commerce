// Selo fixo quando o app roda no ambiente de teste (VITE_AMBIENTE=teste,
// definido só em .env.development) — evita confundir teste com a loja real.
export default function EnvBadge() {
  if (import.meta.env.VITE_AMBIENTE !== "teste") return null;
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        left: 12,
        bottom: 12,
        zIndex: 9999,
        padding: "6px 12px",
        borderRadius: 999,
        background: "#7c3aed",
        color: "#fff",
        font: "700 12px/1.2 system-ui, sans-serif",
        letterSpacing: 0.3,
        boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
        pointerEvents: "none",
      }}
    >
      🧪 AMBIENTE DE TESTE
    </div>
  );
}
