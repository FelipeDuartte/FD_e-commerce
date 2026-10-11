import "./Footer.css";
import BiIcon from "../BiIcon/BiIcon";
export default function Footer() {
  return (
    <footer id="contato" className="footer-custom text-white">
      <div className="container">
        <div className="row g-4 mb-4">
          <div className="col-md-4">
            <h5 className="logo">
              Dudu <span>Bebidas</span>
            </h5>
            <p className="text-light">
              As melhores bebidas com entrega rápida e preços imbatíveis. Sua
              satisfação é nossa prioridade!
            </p>
            <div className="d-flex gap-3">
              <a href="#" className="footer-social-link">
                <BiIcon name="envelope" />
              </a>
              <a href="https://www.instagram.com/dudu_bebidas_vn_/" target="_blank" className="footer-social-link">
                <BiIcon name="instagram" />
              </a>
              <a href="https://wa.me/553183077990" target="_blank" className="footer-social-link">
                <BiIcon name="whatsapp" />
              </a>
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
              <li>
                <a href="#about" className="footer-link">
                  <BiIcon name="chevron-right" />
                  Sobre Nós
                </a>
              </li>
              
            </ul>
          </div>

          <div className="col-md-4">
            <h6 className="footer-section-title">Entre em Contato</h6>
            <div className="footer-contact-item">
              <BiIcon name="whatsapp" />
              <div className="contact-content">
                <div className="contact-label">WhatsApp</div>
                <div className="contact-info">+55 (31) 8307-7990</div>
              </div>
            </div>
            <div className="footer-contact-item">
              <BiIcon name="envelope" />
              <div className="contact-content">
                <div className="contact-label">Email</div>
                <div className="contact-info">vendavovavirtual@yaoo.com.br</div>
              </div>
            </div>
            <div className="footer-contact-item">
              <BiIcon name="geo-alt" />
              <div className="contact-content">
                <div className="contact-label">Localização</div>
                <div className="contact-info">Minas Gerais, MG</div>
              </div>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="row">
            <div className="col text-center">
              <p>
                <a href="/privacy-policy">Política de Privacidade</a> - <a href="/terms-service">Termos de Serviço</a>
              </p>
              <p>
                &copy; 2026 Dudu Bebidas. Todos os direitos reservados. | Beba com
                Moderação.
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