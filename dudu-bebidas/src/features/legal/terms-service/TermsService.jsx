// src/page/TermsOfService/TermsOfService.jsx
export default function TermsOfService() {
  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", padding: "48px 24px 80px", fontFamily: "Inter, sans-serif", color: "#ccc" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 48 }}>
          <span style={{ color: "#fff" }}>Dudu</span>
          <span style={{ color: "#ffd000" }}>Bebidas</span>
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#fff", marginBottom: 8 }}>
          Termos de Serviço
        </h1>
        <p style={{ fontSize: 13, color: "#444", marginBottom: 48 }}>
          Última atualização: março de 2026
        </p>

        <p style={{ color: "#888", marginBottom: 32 }}>
          Ao utilizar o site e os serviços da <strong style={{ color: "#ddd" }}>Dudu Bebidas</strong>, você concorda com os termos descritos abaixo. Leia com atenção antes de realizar qualquer pedido.
        </p>

        {[
          {
            title: "1. Sobre o serviço",
            content: "A Dudu Bebidas é um serviço de delivery de bebidas que atende aos bairros Minas Caixas, Serra Verde, Parque São Pedro e Venda Nova, na cidade de Belo Horizonte — MG. Nos reservamos o direito de alterar a área de entrega a qualquer momento.",
          },
          {
            title: "2. Elegibilidade",
            content: "Nosso serviço é destinado exclusivamente a pessoas maiores de 18 anos. Ao realizar um pedido, você declara ter idade legal para adquirir bebidas alcoólicas conforme a legislação brasileira. Podemos solicitar comprovante de idade na entrega.",
          },
          {
            title: "3. Pedidos e pagamentos",
            content: null,
            items: [
              "Os pedidos são realizados exclusivamente pelo site.",
              "Aceitamos pagamento via PIX, cartão e dinheiro na entrega.",
              "Os preços exibidos são em reais (R$) e podem ser alterados sem aviso prévio.",
              "O frete é calculado com base no bairro selecionado no carrinho.",
              "Após a confirmação do pedido, o cancelamento deve ser solicitado imediatamente pelo contato abaixo.",
            ],
          },
          {
            title: "4. Entrega",
            content: null,
            items: [
              "O prazo de entrega estimado é de até 30 minutos após a confirmação do pedido.",
              "Fatores externos como trânsito e condições climáticas podem influenciar no prazo.",
              "A entrega é realizada somente no endereço informado no pedido.",
              "Em caso de ausência no momento da entrega, entraremos em contato pelo telefone informado.",
            ],
          },
          {
            title: "5. Responsabilidades",
            content: null,
            items: [
              "A Dudu Bebidas não se responsabiliza por informações incorretas fornecidas pelo usuário.",
              "Não nos responsabilizamos por atrasos causados por fatores externos.",
              "O usuário é responsável por fornecer um endereço de entrega correto e completo.",
            ],
          },
          {
            title: "6. Conta de usuário",
            content: null,
            items: [
              "Você é responsável pela segurança da sua conta e senha.",
              "Não compartilhe suas credenciais de acesso com terceiros.",
              "Reservamo-nos o direito de suspender contas que violem estes termos.",
            ],
          },
          {
            title: "7. Alterações nos termos",
            content: "Podemos atualizar estes termos periodicamente. Quando isso ocorrer, atualizaremos a data no topo desta página. O uso continuado do serviço após as alterações implica na aceitação dos novos termos.",
          },
          {
            title: "8. Contato",
            content: null,
            contact: true,
          },
        ].map((section) => (
          <div key={section.title} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#ffd000", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
              {section.title}
            </h2>
            {section.content && (
              <p style={{ fontSize: 15, color: "#888", lineHeight: 1.8 }}>{section.content}</p>
            )}
            {section.items && (
              <ul style={{ paddingLeft: 20 }}>
                {section.items.map((item, i) => (
                  <li key={i} style={{ fontSize: 15, color: "#888", marginBottom: 6, lineHeight: 1.7 }}>{item}</li>
                ))}
              </ul>
            )}
            {section.contact && (
              <p style={{ fontSize: 15, color: "#888" }}>
                Dúvidas ou solicitações? Entre em contato:{" "}
                <a href="mailto:support.techflow@gmail.com" style={{ color: "#ffd000" }}>
                  support.techflow@gmail.com
                </a>
              </p>
            )}
          </div>
        ))}

        <div style={{ height: 1, background: "#1a1a1a", margin: "40px 0" }} />

        <p style={{ fontSize: 13, color: "#333", textAlign: "center" }}>
          © 2026 Dudu Bebidas · Todos os direitos reservados
        </p>

      </div>
    </div>
  );
}