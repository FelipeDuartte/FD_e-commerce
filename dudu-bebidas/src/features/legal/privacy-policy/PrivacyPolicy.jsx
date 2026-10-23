import { LegalContact, LegalLayout, LegalSection } from "../LegalLayout";
import { useLegalInfo } from "../legalInfo";

// Política de Privacidade — texto montado com os dados da loja (marca + banco).
export default function PrivacyPolicy() {
  const info = useLegalInfo();
  const onlineCard = info.payments.includes("cartão online");

  return (
    <LegalLayout
      info={info}
      title="Política de Privacidade"
      intro={
        <>
          A <strong style={{ color: "#ddd" }}>{info.name}</strong> respeita a sua privacidade e está comprometida em
          proteger os dados pessoais que você nos fornece ao utilizar nosso site e serviço de delivery.
        </>
      }
    >
      <LegalSection
        title="1. Informações que coletamos"
        items={[
          "Dados de cadastro: nome completo, e-mail e telefone.",
          "Dados de entrega: endereço completo, bairro e complemento.",
          "Dados de pedido: produtos, valores e forma de pagamento.",
          "Login social: quando usa o Google, recebemos seu nome e e-mail.",
        ]}
      />

      <LegalSection
        title="2. Como utilizamos suas informações"
        items={[
          "Processar e entregar seus pedidos.",
          "Entrar em contato sobre o status da entrega.",
          "Melhorar nossos serviços e experiência de uso.",
          "Cumprir obrigações legais quando necessário.",
        ]}
      />

      <LegalSection
        title="3. Compartilhamento de dados"
        items={[
          "Supabase: banco de dados utilizado para armazenar seus dados com segurança.",
          "Google: utilizado exclusivamente para autenticação via login social.",
          onlineCard && "Mercado Pago: processa os pagamentos com cartão online; os dados do cartão não passam pelo nosso sistema.",
        ]}
      />

      <LegalSection
        title="4. Seus direitos"
        items={[
          "Acessar os dados que temos sobre você.",
          "Solicitar a correção de dados incorretos.",
          "Solicitar a exclusão dos seus dados.",
          "Revogar o consentimento a qualquer momento.",
        ]}
      />

      <LegalSection
        title="5. Menores de idade"
        content={
          info.ageGate
            ? "Nosso serviço é destinado exclusivamente a maiores de 18 anos, conforme a legislação brasileira sobre venda de bebidas alcoólicas."
            : "Não coletamos intencionalmente dados de menores de idade sem o consentimento de um responsável legal."
        }
      />

      <LegalSection title="6. Contato">
        <LegalContact email={info.contactEmail} label="Dúvidas? Entre em contato:" />
      </LegalSection>
    </LegalLayout>
  );
}
