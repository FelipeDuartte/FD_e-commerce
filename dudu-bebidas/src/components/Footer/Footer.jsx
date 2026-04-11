import "./Footer.css";
import logoDev from "../../assets/Logo-my-company-small.png";
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
                <i className="bi bi-envelope"></i>
              </a>
              <a href="https://www.instagram.com/dudu_bebidas_vn_/" target="_blank" className="footer-social-link">
                <i className="bi bi-instagram"></i>
              </a>
              <a href="https://wa.me/31999575029" target="_blank" className="footer-social-link">
                <i className="bi bi-whatsapp"></i>
              </a>
            </div>
          </div>

          <div className="col-md-4">
            <h6 className="footer-section-title">Links Rápidos</h6>
            <ul>
              <li>
                <a href="#hero" className="footer-link">
                  <i className="bi bi-chevron-right"></i>
                  Início
                </a>
              </li>
              <li>
                <a href="#produtos" className="footer-link">
                  <i className="bi bi-chevron-right"></i>
                  Produtos
                </a>
              </li>
              <li>
                <a href="#about" className="footer-link">
                  <i className="bi bi-chevron-right"></i>
                  Sobre Nós
                </a>
              </li>
              
            </ul>
          </div>

          <div className="col-md-4">
            <h6 className="footer-section-title">Entre em Contato</h6>
            <div className="footer-contact-item">
              <i className="bi bi-whatsapp"></i>
              <div className="contact-content">
                <div className="contact-label">WhatsApp</div>
                <div className="contact-info">(31) 99957-5029</div>
              </div>
            </div>
            <div className="footer-contact-item">
              <i className="bi bi-envelope"></i>
              <div className="contact-content">
                <div className="contact-label">Email</div>
                <div className="contact-info">vendavovavirtual@yaoo.com.br</div>
              </div>
            </div>
            <div className="footer-contact-item">
              <i className="bi bi-geo-alt"></i>
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
              <p className="text-warning mt-2 fst-italic"> <span className="fw-bold">Desenvolvido por</span> 
              <span><img src={logoDev} alt="" /></span> , Crie seu site e-commerce. <a href="https://felipeduartte.github.io/Portfolio/" className="text-warning">clique aqui!</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}