import React, { useState, useEffect, useRef } from "react";
import { ShoppingCart } from "lucide-react";
import "./Hero.css";

// Importações das imagens pequenas
import bannerCerveja from "../../assets/CervejaBanner.png";
import Bannerwisky from "../../assets/WiskyBanner.png";
import Bannervinhos from "../../assets/vinhoBanner.png";
import BannerGin from "../../assets/ginBanner.png";

// Importações das imagens grandes
import bannerCervejaLg from "../../assets/cervejaBanner-lg.png";
import BannerwiskyLg from "../../assets/wiskyBanner-lg.png";
import BannervinhosLg from "../../assets/vinhoBanner-lg.png";
import BannerGinLg from "../../assets/ginBanner-lg.png";

export default function Hero() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const carouselRef = useRef(null);

  // Distância mínima para considerar um swipe (em pixels)
  const minSwipeDistance = 50;

  const banners = [
    {
      id: 1,
      title: "Mega Promoção",
      subtitle: "Cervejas Premium",
      description: "Até 40% OFF em cervejas importadas",
      badge: "OFERTA",
      imageSmall: bannerCerveja,
      imageLarge: bannerCervejaLg,
      ctaText: "Ver Ofertas",
    },
    {
      id: 2,
      title: "Novidades",
      subtitle: "Vinhos Selecionados",
      description: "Acabou de chegar - Importados direto da Europa",
      badge: "NOVO",
      imageSmall: Bannervinhos,
      imageLarge: BannervinhosLg,
      ctaText: "Conferir Novidades",
    },
    {
      id: 3,
      title: "Super Desconto",
      subtitle: "Whisky & Destilados",
      description: "Descontos imperdíveis em destilados premium",
      badge: "HOT",
      imageSmall: Bannerwisky,
      imageLarge: BannerwiskyLg,
      ctaText: "Aproveitar Agora",
    },
    {
      id: 4,
      title: "Lançamento",
      subtitle: "Gin Artesanal",
      description: "Sabores exclusivos direto do produtor",
      badge: "EXCLUSIVO",
      imageSmall: BannerGin,
      imageLarge: BannerGinLg,
      ctaText: "Conhecer Produtos",
    },
  ];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % banners.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length);
  };

  // Handlers para touch/swipe
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      nextSlide();
    }
    if (isRightSwipe) {
      prevSlide();
    }
  };

  // Detecta tamanho da tela inicial e mudanças
  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1080);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  // Auto-play do carrossel
  useEffect(() => {
    const interval = setInterval(nextSlide, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="hero" className="hero-carousel">
      <div 
        className="carousel-wrapper"
        ref={carouselRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {banners.map((banner, index) => {
          const currentImage = isLargeScreen ? banner.imageLarge : banner.imageSmall;
          
          return (
            <div
              key={banner.id}
              className={`carousel-slide ${index === currentSlide ? "active" : ""}`}
              style={{ backgroundImage: `url(${currentImage})` }}
            >
              <div className="carousel-overlay"></div>

              <div className="container">
                <div className="row justify-content-center">
                  <div className="col-lg-10 col-xl-8">
                    <div className="carousel-content">
                      <span className="banner-badge">{banner.badge}</span>
                      <h1 className="banner-title">
                        {banner.title}
                        <span className="banner-highlight">
                          {banner.subtitle}
                        </span>
                      </h1>
                      <p className="banner-description">{banner.description}</p>
                      <a href="#produtos" className="btn-banner">
                        <ShoppingCart size={20} />
                        <span>{banner.ctaText}</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dots Indicator */}
      <div className="carousel-dots">
        {banners.map((_, index) => (
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