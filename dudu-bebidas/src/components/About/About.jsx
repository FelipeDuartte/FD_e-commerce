import { useEffect, useRef, useState } from "react";
import "./About.css";

const stats = [
  { num: "25+", label: "Anos de mercado" },
  { num: "500+", label: "Rótulos" },
  { num: "BH", label: "Delivery" },
  { num: "100%", label: "Qualidade" },
];

const chips = [
  { icon: "📍", text: "Rua Edgar Torres, 650" },
  { icon: "🛵", text: "Delivery disponível" },
  { icon: "🍺", text: "Todos os tipos de bebidas" },
  { icon: "⭐", text: "Desde 2000" },
];

export default function SobreDuduBebidas() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div id="about" className="dudu-sobre" ref={ref}>

        {/* body */}
        <div className="body-wrap">
          <div className="row g-4 align-items-center">

            {/* texto */}
            <div className={`col-12 col-md-7 fade-in${visible ? " visible" : ""}`}
                 style={{ transitionDelay: "0s" }}>
              <p className="section-eyebrow">Quem somos</p>
              <h2 className="section-title">25 anos levando a<br />melhor bebida até você</h2>
              <div className="title-underline" />
              <p className="section-text">
                Nascemos em Belo Horizonte com uma missão simples: reunir as melhores
                marcas da região em um só lugar, com o atendimento caloroso que só
                o mineiro sabe dar. Cervejas, vinhos, destilados e muito mais —
                na loja ou direto na sua porta pelo delivery. 🍻
              </p>
            </div>

            {/* stats */}
            <div className={`col-12 col-md-5 fade-in${visible ? " visible" : ""}`}
                 style={{ transitionDelay: "0.15s" }}>
              <div className="row g-2">
                {stats.map((s, i) => (
                  <div className="col-6" key={i}>
                    <div className="stat-box">
                      <div className="stat-num">{s.num}</div>
                      <div className="stat-label">{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <hr className="divider" />

          {/* chips de info */}
          <div className={`info-row fade-in${visible ? " visible" : ""}`}
               style={{ transitionDelay: "0.3s" }}>
            {chips.map((c, i) => (
              <span className="info-chip" key={i}>
                {c.icon} {c.text}
              </span>
            ))}
          </div>
        </div>
      </div>
  );
}