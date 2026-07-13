import { useState, useEffect, useRef, useCallback } from "react";
import { ShoppingCart } from "lucide-react";
import "./Hero.css";
import { useProductCategories } from "../../hooks/useProductCategories";

// Imagens pequenas
import bannerCerveja from "../../assets/CervejaBanner.png";
import bannerWisky from "../../assets/wiskyBanner.png";
import bannerVinhos from "../../assets/vinhoBanner.png";
import bannerGin from "../../assets/ginBanner.png";

// Imagens grandes
import bannerCervejaLg from "../../assets/cervejaBanner-lg.png";
import bannerWiskyLg from "../../assets/wiskyBanner-lg.png";
import bannerVinhosLg from "../../assets/vinhoBanner-lg.png";
import bannerGinLg from "../../assets/ginBanner-lg.png";

// Configurações
const AUTO_PLAY_DELAY = 5000;
const MIN_SWIPE_DISTANCE = 50;
const LARGE_SCREEN_WIDTH = 1080;

// Dados do banner
const BANNERS = [
  {
    id: 1,
    title: "Mega Promoção",
    subtitle: "Cervejas Premium",
    description: "Até 40% OFF em cervejas importadas",
    badge: "OFERTA",
    imageSmall: bannerCerveja,
    imageLarge: bannerCervejaLg,
    ctaText: "Ver Ofertas",
    category: "cerveja",
  },
  {
    id: 2,
    title: "Novidades",
    subtitle: "Vinhos Selecionados",
    description: "Acabou de chegar - Importados direto da Europa",
    badge: "NOVO",
    imageSmall: bannerVinhos,
    imageLarge: bannerVinhosLg,
    ctaText: "Conferir Novidades",
    category: "vinho",
  },
  {
    id: 3,
    title: "Super Desconto",
    subtitle: "Whisky & Destilados",
    description: "Descontos imperdíveis em destilados premium",
    badge: "HOT",
    imageSmall: bannerWisky,
    imageLarge: bannerWiskyLg,
    ctaText: "Aproveitar Agora",
    category: "destilado",
  },
  {
    id: 4,
    title: "Lançamento",
    subtitle: "Gin Artesanal",
    description: "Sabores exclusivos direto do produtor",
    badge: "EXCLUSIVO",
    imageSmall: bannerGin,
    imageLarge: bannerGinLg,
    ctaText: "Conhecer Produtos",
    category: "destilado",
  },
];

export default function Hero({ onCategorySelect }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const carouselRef = useRef(null);
  const totalSlides = BANNERS.length;

  // Os banners abaixo são conteúdo editorial (imagem/texto fixos por
  // categoria), então não dá pra buscá-los do banco. Mas usamos a lista
  // de categorias ativas para conferir, no clique, se o id ainda existe
  // — se a categoria "cerveja"/"vinho"/"destilado" for renomeada ou
  // excluída no admin, o clique cai em "Todos" em vez de mostrar uma
  // lista vazia sem explicação.
  const { categories: liveCategories } = useProductCategories();

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  const handleBannerClick = useCallback(
    (category) => {
      const stillExists = liveCategories.some((c) => c.id === category);
      if (!stillExists) {
        console.warn(
          `[Hero] Categoria "${category}" não existe mais (renomeada/excluída) — mostrando "Todos".`,
        );
      }
      onCategorySelect?.(stillExists ? category : "todos");
      const produtosSection = document.getElementById("produtos");
      produtosSection?.scrollIntoView({ behavior: "smooth" });
    },
    [onCategorySelect, liveCategories],
  );

  // Touch handlers
  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > MIN_SWIPE_DISTANCE) nextSlide();
    if (distance < -MIN_SWIPE_DISTANCE) prevSlide();
  };

  // Detecta tamanho da tela
  useEffect(() => {
    const handleResize = () => {
      setIsLargeScreen(window.innerWidth >= LARGE_SCREEN_WIDTH);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Auto-play
  useEffect(() => {
    const interval = setInterval(nextSlide, AUTO_PLAY_DELAY);
    return () => clearInterval(interval);
  }, [nextSlide]);

  return (
    <section id="hero" className="hero-carousel">
      <div
        className="carousel-wrapper"
        ref={carouselRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {BANNERS.map((banner, index) => {
          const backgroundImage = isLargeScreen
            ? banner.imageLarge
            : banner.imageSmall;

          return (
            <div
              key={banner.id}
              className={`carousel-slide ${index === currentSlide ? "active" : ""}`}
              style={{ backgroundImage: `url(${backgroundImage})` }}
            >
              <div className="carousel-overlay" />

              <div className="container">
                <div className="row justify-content-center">
                  <div className="col-10 col-sm-9 col-md-8 col-lg-7 col-xl-6">
                    <div className="carousel-content">
                      {/* Badge */}
                      <span className="banner-badge">{banner.badge}</span>

                      {/* Título */}
                      <h2 className="banner-title">
                        {banner.title}
                        <span className="banner-highlight">
                          {banner.subtitle}
                        </span>
                      </h2>

                      {/* Descrição (oculta em tablet/mobile via CSS) */}
                      <p className="banner-description">{banner.description}</p>

                      {/* CTA */}
                      <button
                        className="btn-banner"
                        onClick={() => handleBannerClick(banner.category)}
                        aria-label={`${banner.ctaText} - ${banner.subtitle}`}
                      >
                        <ShoppingCart size={18} />
                        {banner.ctaText}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Indicadores */}
      <div className="carousel-dots">
        {BANNERS.map((_, index) => (
          <button
            key={index}
            className={`dot ${index === currentSlide ? "active" : ""}`}
            onClick={() => setCurrentSlide(index)}
            aria-label={`Ir para slide ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
