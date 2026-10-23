// Marca da Dudu Bebidas. Cada loja tem uma pasta com o mesmo nome do seu
// slug (VITE_STORE_SLUG) — o build usa só a marca da loja dele.
// Os campos estão documentados em src/brands/README.md.
const CDN = "https://res.cloudinary.com/dfcsficmg/image/upload";

export default {
  name: "Dudu Bebidas",
  logoText: ["Dudu", "Bebidas"],
  logoUrl: `${CDN}/v1786649996/logo_dudu-bebidas.webp`,
  faviconUrl: `${CDN}/v1786649996/logo_dudu-bebidas.webp`,

  colors: {
    primary: "#ffd000",
    light: "#ffed4e",
    dark: "#b8860b",
    deep: "#ffaa00", // ponta dos degradês
  },

  seo: {
    title: "Dudu Bebidas — Delivery de Bebidas em BH",
    description:
      "Delivery de bebidas em Belo Horizonte. Cervejas, vinhos, destilados e muito mais. Entrega rápida nos bairros Minas Caixas, Serra Verde, Venda Nova e Parque São Pedro.",
    keywords: "delivery bebidas BH, cerveja gelada Belo Horizonte, bebidas Venda Nova",
    url: "https://dudubebidas.fdigitalbr.com.br/",
    ogTitle: "Dudu Bebidas — Delivery de Bebidas em BH",
    ogDescription: "Peça suas bebidas favoritas com entrega rápida!",
    googleVerification: "BBjKwQzg8a9hnnwv2Iz682E3B5YLfi-PsS8xcJosgcA",
    facebookVerification: "vt199nerrrlazhj84z2bmox0qr51hp",
  },

  searchPlaceholder: "Buscar bebidas...",
  productsLabel: "Bebidas", // item do menu do celular

  // Faixa colorida no topo do site (troca sozinha)
  topBanners: [
    {
      titulo: "🔥 PROMOÇÕES ESPECIAIS PELO SITE 🔥",
      subtitulo: "Descontos incríveis para você",
      texto: "Aproveite preços imperdíveis em bebidas selecionadas",
      bg: "linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)",
      titleColor: "#000",
      textColor: "#333",
    },
    {
      titulo: "⚡ NOVIDADES ⚡",
      subtitulo: "Lançamentos fresquinhos",
      texto: "Confira nossos novos produtos!",
      bg: "linear-gradient(135deg, #dc3545 0%, #ff6b6b 100%)",
      titleColor: "#fff",
      textColor: "#fff",
    },
    {
      titulo: "🚚 Delivery Rapido 🚚",
      subtitulo: "Entrega rapida e segura",
      texto: "Receba em casa suas bebidas favoritas em minutos",
      bg: "linear-gradient(135deg, #000 0%, #333 100%)",
      titleColor: "#ffd700",
      textColor: "#fff",
    },
  ],

  // Carrossel grande. category = categoria aberta ao clicar no botão.
  heroSlides: [
    {
      title: "Mega Promoção",
      subtitle: "Cervejas Premium",
      description: "Até 40% OFF em cervejas importadas",
      badge: "OFERTA",
      imageSmall: `${CDN}/v1786649995/CervejaBanner-CAYjoOTV_1_yu45c7.webp`,
      imageLarge: `${CDN}/v1786649996/cervejaBanner-lg-DrKCbcAy_1_mtznt0.webp`,
      ctaText: "Ver Ofertas",
      category: "cerveja",
    },
    {
      title: "Novidades",
      subtitle: "Vinhos Selecionados",
      description: "Acabou de chegar - Importados direto da Europa",
      badge: "NOVO",
      imageSmall: `${CDN}/v1786649996/vinhoBanner-DUfHVLwr_1_g3mhty.webp`,
      imageLarge: `${CDN}/v1786649997/vinhoBanner-lg-aexSNgB6_1_glalbm.webp`,
      ctaText: "Conferir Novidades",
      category: "vinho",
    },
    {
      title: "Super Desconto",
      subtitle: "Whisky & Destilados",
      description: "Descontos imperdíveis em destilados premium",
      badge: "HOT",
      imageSmall: `${CDN}/v1786649997/wiskyBanner-AhTFNrfB_1_kx6eal.webp`,
      imageLarge: `${CDN}/v1786649998/wiskyBanner-lg-ButYwblz_1_vxgnfo.webp`,
      ctaText: "Aproveitar Agora",
      category: "destilado",
    },
    {
      title: "Lançamento",
      subtitle: "Gin Artesanal",
      description: "Sabores exclusivos direto do produtor",
      badge: "EXCLUSIVO",
      imageSmall: `${CDN}/v1786649996/ginBanner-DM7yVTzI_1_tkthnx.webp`,
      imageLarge: `${CDN}/v1786649996/ginBanner-lg-CPtHbopB_1_obe6ug.webp`,
      ctaText: "Conhecer Produtos",
      category: "destilado",
    },
  ],

  about: {
    eyebrow: "Quem somos",
    title: ["20 anos levando a", "melhor bebida até você"],
    text:
      "Nascemos em Belo Horizonte com uma missão simples: reunir as melhores marcas de bebidas da região em um só lugar, com o atendimento caloroso que só o mineiro sabe dar. Cervejas, vinhos, destilados e muito mais — na loja ou direto na sua porta pelo delivery. 🍻",
    stats: [
      { num: "20+", label: "Anos de mercado" },
      { num: "500+", label: "Rótulos" },
      { num: "BH", label: "Delivery" },
      { num: "100%", label: "Qualidade" },
    ],
    // O chip de endereço (📍) entra sozinho, vindo do cadastro da loja
    chips: [
      { icon: "🛵", text: "Delivery disponível" },
      { icon: "🍺", text: "Melhores Bebidas" },
      { icon: "⭐", text: "Desde 2000" },
    ],
  },

  footer: {
    tagline:
      "As melhores bebidas com entrega rápida e preços imbatíveis. Sua satisfação é nossa prioridade!",
    email: "vendavovavirtual@yaoo.com.br",
    location: "Minas Gerais, MG",
    closing: "Beba com Moderação.",
  },

  // Termos de uso e política de privacidade (bairros, pagamentos e +18
  // vêm do cadastro da loja no banco)
  legal: {
    city: "Belo Horizonte — MG",
    deliveryTime: "30 minutos",
    contactEmail: "support.techflow@gmail.com",
    updatedAt: "março de 2026",
  },
};
