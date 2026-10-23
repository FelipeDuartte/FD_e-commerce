import { useEffect, useRef, useState } from "react";
import "./About.css";
import { pickupAddress } from "../../../../shared/utils/storeContact";
import { getBrand } from "../../../../shared/brand/brand";

// Texto do "Sobre" vem da marca da loja (about). Sem isso, a seção não aparece.

export default function About() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const about = getBrand().about;
  const address = pickupAddress();
  const baseChips = about?.chips ?? [];
  const chips = address ? [{ icon: "📍", text: address.street }, ...baseChips] : baseChips;
  const stats = about?.stats ?? [];
  const titleLines = [].concat(about?.title ?? []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  if (!about) return null;

  return (
    <div id="about" className="dudu-sobre" ref={ref}>

        {/* body */}
        <div className="body-wrap">
          <div className="row g-4 align-items-center">

            {/* texto */}
            <div className={`col-12 col-md-7 fade-in${visible ? " visible" : ""}`}
                 style={{ transitionDelay: "0s" }}>
              {about.eyebrow && <p className="section-eyebrow">{about.eyebrow}</p>}
              <h2 className="section-title">
                {titleLines.map((line, i) => (
                  <span key={i}>{i > 0 && <br />}{line}</span>
                ))}
              </h2>
              <div className="title-underline" />
              <p className="section-text">{about.text}</p>
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