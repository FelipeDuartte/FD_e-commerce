import { LegalContact, LegalLayout, LegalSection } from "../LegalLayout";
import { joinList, useLegalInfo } from "../legalInfo";

// Termos de Serviço — texto montado com os dados da loja (marca + banco).
export default function TermsOfService() {
  const info = useLegalInfo();
  const { name } = info;

  const area = info.neighborhoods.length
    ? `que atende aos bairros ${joinList(info.neighborhoods)}${info.city ? `, na cidade de ${info.city}` : ""}`
    : `que atende a região informada no carrinho${info.city ? `, em ${info.city}` : ""}`;
  const pickup = info.hasPickup ? " Também é possível retirar o pedido na loja." : "";

  return (
    <LegalLayout
      info={info}
      title="Termos de Serviço"
      intro={
        <>
          Ao utilizar o site e os serviços da <strong style={{ color: "#ddd" }}>{name}</strong>, você concorda com os
          termos descritos abaixo. Leia com atenção antes de realizar qualquer pedido.
        </>
      }
    >
      <LegalSection
        title="1. Sobre o serviço"
        content={`A ${name} é um serviço de delivery ${area}.${pickup} Nos reservamos o direito de alterar a área de entrega a qualquer momento.`}
      />

      <LegalSection
        title="2. Elegibilidade"
        content={
          info.ageGate
            ? "Nosso serviço é destinado exclusivamente a pessoas maiores de 18 anos. Ao realizar um pedido, você declara ter idade legal para adquirir bebidas alcoólicas conforme a legislação brasileira. Podemos solicitar comprovante de idade na entrega."
            : "Para realizar pedidos, você deve ter capacidade legal para contratar ou estar autorizado por um responsável."
        }
      />

      <LegalSection
        title="3. Pedidos e pagamentos"
        items={[
          "Os pedidos são realizados exclusivamente pelo site.",
          info.payments.length
            ? `Aceitamos pagamento via ${joinList(info.payments)}.`
            : "Aceitamos as formas de pagamento exibidas na finalização do pedido.",
          "Os preços exibidos são em reais (R$) e podem ser alterados sem aviso prévio.",
          "O frete é calculado com base no bairro selecionado no carrinho.",
          "Após a confirmação do pedido, o cancelamento deve ser solicitado imediatamente pelo contato abaixo.",
        ]}
      />

      <LegalSection
        title="4. Entrega"
        items={[
          info.deliveryTime
            ? `O prazo de entrega estimado é de até ${info.deliveryTime} após a confirmação do pedido.`
            : "O prazo de entrega estimado é informado após a confirmação do pedido.",
          "Fatores externos como trânsito e condições climáticas podem influenciar no prazo.",
          "A entrega é realizada somente no endereço informado no pedido.",
          "Em caso de ausência no momento da entrega, entraremos em contato pelo telefone informado.",
        ]}
      />

      <LegalSection
        title="5. Responsabilidades"
        items={[
          `A ${name} não se responsabiliza por informações incorretas fornecidas pelo usuário.`,
          "Não nos responsabilizamos por atrasos causados por fatores externos.",
          "O usuário é responsável por fornecer um endereço de entrega correto e completo.",
        ]}
      />

      <LegalSection
        title="6. Conta de usuário"
        items={[
          "Você é responsável pela segurança da sua conta e senha.",
          "Não compartilhe suas credenciais de acesso com terceiros.",
          "Reservamo-nos o direito de suspender contas que violem estes termos.",
        ]}
      />

      <LegalSection
        title="7. Alterações nos termos"
        content="Podemos atualizar estes termos periodicamente. Quando isso ocorrer, atualizaremos a data no topo desta página. O uso continuado do serviço após as alterações implica na aceitação dos novos termos."
      />

      <LegalSection title="8. Contato">
        <LegalContact email={info.contactEmail} />
      </LegalSection>
    </LegalLayout>
  );
}
