import "./Banner.css";

export default function Banner({ banners, currentBanner }) {
  return (
    <div className="promo-strip position-relative overflow-hidden">
      {banners.map((banner, index) => (
        <div
          key={banner.id}
          className={`promo-strip-slide ${
            index === currentBanner
              ? ""
              : "position-absolute top-0 start-0 w-100"
          }`}
          style={{
            opacity: index === currentBanner ? 1 : 0,
            background: banner.bg,
          }}
          aria-hidden={index !== currentBanner}
        >
          <div className="promo-strip-content" style={{ color: banner.titleColor }}>
            <strong className="promo-strip-title">{banner.titulo}</strong>
            <span className="promo-strip-sub">{banner.subtitulo}</span>
            <span className="promo-strip-text" style={{ color: banner.textColor }}>
              {banner.texto}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
