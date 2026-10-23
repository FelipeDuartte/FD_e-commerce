// Molde comum dos Termos de Serviço e da Política de Privacidade.
const sectionTitle = {
  fontSize: 13, fontWeight: 700, color: "var(--brand)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12,
};
const text = { fontSize: 15, color: "#888", lineHeight: 1.8 };

export function LegalLayout({ info, title, intro, children }) {
  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", padding: "48px 24px 80px", fontFamily: "Inter, sans-serif", color: "#ccc" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 48 }}>
          <span style={{ color: "#fff" }}>{info.logoText[0]}</span>
          {info.logoText[1] && <span style={{ color: "var(--brand)" }}> {info.logoText[1]}</span>}
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#fff", marginBottom: 8 }}>{title}</h1>
        {info.updatedAt && (
          <p style={{ fontSize: 13, color: "#444", marginBottom: 48 }}>Última atualização: {info.updatedAt}</p>
        )}

        <p style={{ color: "#888", marginBottom: 32 }}>{intro}</p>

        {children}

        <div style={{ height: 1, background: "#1a1a1a", margin: "40px 0" }} />

        <p style={{ fontSize: 13, color: "#333", textAlign: "center" }}>
          © {new Date().getFullYear()} {info.name} · Todos os direitos reservados
        </p>
      </div>
    </div>
  );
}

// Seção numerada: texto (content) e/ou lista (items)
export function LegalSection({ title, content, items, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={sectionTitle}>{title}</h2>
      {content && <p style={text}>{content}</p>}
      {items && (
        <ul style={{ paddingLeft: 20 }}>
          {items.filter(Boolean).map((item, i) => (
            <li key={i} style={{ ...text, marginBottom: 6, lineHeight: 1.7 }}>{item}</li>
          ))}
        </ul>
      )}
      {children}
    </div>
  );
}

export function LegalContact({ email, label = "Dúvidas ou solicitações? Entre em contato:" }) {
  if (!email) return <p style={text}>Dúvidas ou solicitações? Fale com a loja pelos contatos no rodapé do site.</p>;
  return (
    <p style={text}>
      {label}{" "}
      <a href={`mailto:${email}`} style={{ color: "var(--brand)" }}>{email}</a>
    </p>
  );
}
