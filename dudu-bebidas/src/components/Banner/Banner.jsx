import "./Banner.css";

export default function Banner({ banners, currentBanner }) {
  return (
    <div className="position-relative overflow-hidden">
      {banners.map((banner, index) => (
        <div
          key={banner.id}
          className={`banner-slide ${
            index === currentBanner
              ? ""
              : "position-absolute top-0 start-0 w-100"
          }`}
          style={{
            opacity: index === currentBanner ? 1 : 0,
            background: banner.bg,
          }}
        >
          <div
            className="container text-center py-4 position-relative"
            style={{ zIndex: 1 }}
          >
            <h4
              className="fw-bold mb-2"
              style={{
                color: banner.titleColor,
                fontSize: "24px",
                letterSpacing: "1px",
              }}
            >
              {banner.titulo}
            </h4>
            <p
              className="fw-semibold mb-1"
              style={{
                color: banner.titleColor,
                fontSize: "16px",
                opacity: 0.9,
              }}
            >
              {banner.subtitulo}
            </p>
            <p
              className="mb-0"
              style={{ color: banner.textColor, fontSize: "14px" }}
            >
              {banner.texto}
            </p>
          </div>
        </div>
      ))}

    </div>
  );
}
