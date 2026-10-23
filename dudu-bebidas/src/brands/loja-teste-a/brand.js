// Marca fictícia do AMBIENTE DE TESTE (loja de bebidas). Cor e textos
// propositalmente diferentes da Dudu, pra ficar óbvio que a marca trocou.
export default {
  name: "Loja Teste A",
  logoText: ["Loja", "Teste A"],
  logoUrl: null,
  faviconUrl: null,

  colors: {
    primary: "#22d3ee",
    light: "#67e8f9",
    dark: "#0e7490",
    deep: "#06b6d4", // ponta dos degradês
  },

  seo: {
    title: "Loja Teste A — Ambiente de teste",
    description: "Loja fictícia usada para testes da plataforma.",
    keywords: "teste",
    ogTitle: "Loja Teste A",
    ogDescription: "Loja fictícia de teste.",
  },

  searchPlaceholder: "Buscar bebidas...",
  productsLabel: "Bebidas", // item do menu do celular

  topBanners: [
    {
      titulo: "🧪 LOJA DE TESTE",
      subtitulo: "Nada aqui é real",
      texto: "Pedidos e pagamentos são fictícios",
      bg: "linear-gradient(135deg, #22d3ee 0%, #67e8f9 100%)",
      titleColor: "#000",
      textColor: "#123",
    },
    {
      titulo: "🚚 Entrega teste",
      subtitulo: "Bairros fictícios",
      texto: "Centro e Bairro Teste",
      bg: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      titleColor: "#22d3ee",
      textColor: "#fff",
    },
  ],

  // Sem imagem: o slide usa o fundo (bg) em degradê
  heroSlides: [
    {
      title: "Bem-vindo",
      subtitle: "Loja Teste A",
      description: "Slide de teste sem imagem",
      badge: "TESTE",
      bg: "linear-gradient(135deg, #0e7490 0%, #0f172a 100%)",
      ctaText: "Ver cervejas",
      category: "cerveja",
    },
    {
      title: "Promoções",
      subtitle: "Refrigerantes",
      description: "Testa o clique levando para a categoria",
      badge: "PROMO",
      bg: "linear-gradient(135deg, #155e75 0%, #22d3ee 100%)",
      ctaText: "Ver refrigerantes",
      category: "refrigerante",
    },
  ],

  about: {
    eyebrow: "Sobre a loja",
    title: ["Uma loja de bebidas", "só para testes"],
    text: "Este texto vem do arquivo de marca da Loja Teste A (src/brands/loja-teste-a/brand.js).",
    stats: [
      { num: "12", label: "Produtos" },
      { num: "2", label: "Bairros" },
    ],
    chips: [{ icon: "🧪", text: "Ambiente de teste" }],
  },

  footer: {
    tagline: "Loja fictícia para testar a plataforma.",
    email: "contato@lojateste.a",
    location: "Cidade Teste, MG",
    closing: "Beba com moderação.",
  },

  legal: {
    city: "Cidade Teste — MG",
    deliveryTime: "40 minutos",
    updatedAt: "outubro de 2026",
  },
};
