import "./Footer.css";
import BiIcon from "../BiIcon/BiIcon";
import { formatWhatsapp, instagramLink, whatsappLink } from "../../utils/storeContact";
import { getBrand } from "../../brand/brand";

export default function Footer() {
  const whatsapp = whatsappLink();
  const instagram = instagramLink();
  const { name, logoText, footer, about } = getBrand();
  const email = footer.email ? `mailto:${footer.email}` : null;

  return (
    <footer id="contato" className="footer-custom text-white">
      <div className="container">
        <div className="row g-4 mb-4">
          <div className="col-md-4">
            <h5 className="logo">
              {logoText[0]} {logoText[1] && <span>{logoText[1]}</span>}
            </h5>
            {footer.tagline && <p className="text-light">{footer.tagline}</p>}
            <div className="d-flex gap-3">
              {email && (
                <a href={email} className="footer-social-link">
                  <BiIcon name="envelope" />
                </a>
              )}
              {instagram && (
                <a href={instagram} target="_blank" rel="noreferrer" className="footer-social-link">
                  <BiIcon name="instagram" />
                </a>
              )}
              {whatsapp && (
                <a href={whatsapp} target="_blank" rel="noreferrer" className="footer-social-link">
                  <BiIcon name="whatsapp" />
                </a>
              )}
            </div>
          </div>

          <div className="col-md-4">
            <h6 className="footer-section-title">Links Rápidos</h6>
            <ul>
              <li>
                <a href="#hero" className="footer-link">
                  <BiIcon name="chevron-right" />
                  Início
                </a>
              </li>
              <li>
                <a href="#produtos" className="footer-link">
                  <BiIcon name="chevron-right" />
                  Produtos
                </a>
              </li>
              {about && (
                <li>
                  <a href="#about" className="footer-link">
                    <BiIcon name="chevron-right" />
                    Sobre Nós
                  </a>
                </li>
              )}
              
            </ul>
          </div>

          <div className="col-md-4">
            <h6 className="footer-section-title">Entre em Contato</h6>
            {whatsapp && (
              <div className="footer-contact-item">
                <BiIcon name="whatsapp" />
                <div className="contact-content">
                  <div className="contact-label">WhatsApp</div>
                  <div className="contact-info">{formatWhatsapp()}</div>
                </div>
              </div>
            )}
            {footer.email && (
              <div className="footer-contact-item">
                <BiIcon name="envelope" />
                <div className="contact-content">
                  <div className="contact-label">Email</div>
                  <div className="contact-info">{footer.email}</div>
                </div>
              </div>
            )}
            {footer.location && (
              <div className="footer-contact-item">
                <BiIcon name="geo-alt" />
                <div className="contact-content">
                  <div className="contact-label">Localização</div>
                  <div className="contact-info">{footer.location}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="footer-bottom">
          <div className="row">
            <div className="col text-center">
              <p>
                <a href="/privacy-policy">Política de Privacidade</a> - <a href="/terms-service">Termos de Serviço</a>
              </p>
              <p>
                &copy; {new Date().getFullYear()} {name}. Todos os direitos reservados.
                {footer.closing && ` | ${footer.closing}`}
              </p>
              <p className="text-white mt-2 fst-italic"> <span className="fw-bold">Desenvolvido por</span> 
              <span className="text-primary fw-bold fs-5"> F</span>Digital , Crie seu site e-commerce. <a href="https://wa.me/5531999450717" className="text-warning">clique aqui!</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}