// src/page/PrivacyPolicy/PrivacyPolicy.jsx
export default function PrivacyPolicy() {
  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", padding: "48px 24px 80px", fontFamily: "Inter, sans-serif", color: "#ccc" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 48 }}>
          <span style={{ color: "#fff" }}>Dudu</span>
          <span style={{ color: "#ffd000" }}>Bebidas</span>
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#fff", marginBottom: 8 }}>
          Política de Privacidade
        </h1>
        <p style={{ fontSize: 13, color: "#444", marginBottom: 48 }}>
          Última atualização: março de 2026
        </p>

        <p style={{ color: "#888", marginBottom: 24 }}>
          A <strong style={{ color: "#ddd" }}>Dudu Bebidas</strong> respeita a sua privacidade e está comprometida em proteger os dados pessoais que você nos fornece ao utilizar nosso site e serviço de delivery.
        </p>

        {[
          {
            title: "1. Informações que coletamos",
            items: [
              "Dados de cadastro: nome completo, e-mail e telefone.",
              "Dados de entrega: endereço completo, bairro e complemento.",
              "Dados de pedido: produtos, valores e forma de pagamento.",
              "Login social: quando usa o Google, recebemos seu nome e e-mail.",
            ],
          },
          {
            title: "2. Como utilizamos suas informações",
            items: [
              "Processar e entregar seus pedidos.",
              "Entrar em contato sobre o status da entrega.",
              "Melhorar nossos serviços e experiência de uso.",
              "Cumprir obrigações legais quando necessário.",
            ],
          },
          {
            title: "3. Compartilhamento de dados",
            items: [
              "Supabase: banco de dados utilizado para armazenar seus dados com segurança.",
              "Google: utilizado exclusivamente para autenticação via login social.",
            ],
          },
          {
            title: "4. Seus direitos",
            items: [
              "Acessar os dados que temos sobre você.",
              "Solicitar a correção de dados incorretos.",
              "Solicitar a exclusão dos seus dados.",
              "Revogar o consentimento a qualquer momento.",
            ],
          },
        ].map((section) => (
          <div key={section.title} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#ffd000", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
              {section.title}
            </h2>
            <ul style={{ paddingLeft: 20 }}>
              {section.items.map((item, i) => (
                <li key={i} style={{ fontSize: 15, color: "#888", marginBottom: 6 }}>{item}</li>
              ))}
            </ul>
          </div>
        ))}

        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "#ffd000", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
            5. Menores de idade
          </h2>
          <p style={{ fontSize: 15, color: "#888" }}>
            Nosso serviço é destinado exclusivamente a maiores de 18 anos, conforme a legislação brasileira sobre venda de bebidas alcoólicas.
          </p>
        </div>

        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "#ffd000", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
            6. Contato
          </h2>
          <p style={{ fontSize: 15, color: "#888" }}>
            Dúvidas? Entre em contato:{" "}
            <a href="mailto:support.techflow@gmail.com" style={{ color: "#ffd000" }}>
              support.techflow@gmail.com
            </a>
          </p>
        </div>

        <div style={{ height: 1, background: "#1a1a1a", margin: "40px 0" }} />

        <p style={{ fontSize: 13, color: "#333", textAlign: "center" }}>
          © 2026 Dudu Bebidas · Todos os direitos reservados
        </p>

      </div>
    </div>
  );
}