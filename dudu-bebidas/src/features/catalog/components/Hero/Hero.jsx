import { useState, useEffect, useRef, useCallback } from "react";
import { ShoppingCart } from "lucide-react";
import "./Hero.css";
import { useProductCategories } from "../../../../shared/hooks/useProductCategories";
import { getBrand } from "../../../../shared/brand/brand";

// Configurações
const AUTO_PLAY_DELAY = 5000;
const MIN_SWIPE_DISTANCE = 50;
const LARGE_SCREEN_WIDTH = 1080;
// Slides vêm da marca da loja (src/brands/<slug>/brand.js → heroSlides).
// Slide sem imagem usa o degradê "bg"; loja sem slides não mostra o carrossel.
const DEFAULT_SLIDE_BG = "linear-gradient(135deg, var(--brand-dark) 0%, #111 100%)";

export default function Hero({ onCategorySelect }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const carouselRef = useRef(null);
  const [slides] = useState(() => getBrand().heroSlides);
  const totalSlides = slides.length;

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
    if (totalSlides < 2) return undefined;
    const interval = setInterval(nextSlide, AUTO_PLAY_DELAY);
    return () => clearInterval(interval);
  }, [nextSlide, totalSlides]);

  if (totalSlides === 0) return null;

  return (
    <section id="hero" className="hero-carousel">
      <div
        className="carousel-wrapper"
        ref={carouselRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {slides.map((banner, index) => {
          const image = isLargeScreen
            ? banner.imageLarge || banner.imageSmall
            : banner.imageSmall || banner.imageLarge;
          const backgroundImage = image ? `url(${image})` : banner.bg || DEFAULT_SLIDE_BG;

          return (
            <div
              key={index}
              className={`carousel-slide ${index === currentSlide ? "active" : ""}`}
              style={{ backgroundImage }}
            >
              <div className="carousel-overlay" />

              <div className="container">
                <div className="row justify-content-center">
                  <div className="col-10 col-sm-9 col-md-8 col-lg-7 col-xl-6">
                    <div className="carousel-content">
                      {/* Badge */}
                      {banner.badge && <span className="banner-badge">{banner.badge}</span>}

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
        {slides.map((_, index) => (
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
