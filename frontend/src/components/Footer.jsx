import { Link } from 'react-router-dom';
import '../styles/shell.css';

export default function Footer() {
  return (
    <footer className="gdg-shell-footer">
      <div className="gdg-shell-footer-content">
        <div className="gdg-shell-footer-brand">
          <div className="gdg-shell-gdg-symbol">
            <span className="gdg-shell-symbol-blue" aria-hidden="true" />
            <span className="gdg-shell-symbol-red" aria-hidden="true" />
            <span className="gdg-shell-symbol-green" aria-hidden="true" />
            <span className="gdg-shell-symbol-yellow" aria-hidden="true" />
            <h2 className="gdg-shell-org-name">Google Developer Groups on Campus</h2>
            <h3 className="gdg-shell-uni-name">Cebu Technological University</h3>
          </div>

          <div className="gdg-shell-big-logo">
            <img
              src="/layout-assets/shell/gdg-footer-logo.png"
              alt="GDGoC-CTU Logo"
              className="gdg-shell-gdg-logo"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        </div>

        <div className="gdg-shell-footer-links">
          <div className="gdg-shell-footer-column">
            <h3>Socials</h3>
            <a href="https://www.instagram.com/" target="_blank" rel="noreferrer">
              Instagram
            </a>
            <a href="https://www.facebook.com/gdsc.cebutech" target="_blank" rel="noreferrer">
              Facebook
            </a>
            <a href="https://www.linkedin.com/" target="_blank" rel="noreferrer">
              LinkedIn
            </a>
            <a href="https://www.tiktok.com/" target="_blank" rel="noreferrer">
              TikTok
            </a>
          </div>

          <div className="gdg-shell-footer-column">
            <h3>Navigation</h3>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
            <Link to="/team">Our Team</Link>
            <Link to="/events">Events</Link>
            <Link to="/partners">Partner</Link>
            <Link to="/gallery">Gallery</Link>
          </div>

          <div className="gdg-shell-footer-column gdg-shell-footer-contact">
            <h3>Contact</h3>
            <a href="mailto:gdgsc.ctu@gmail.com">gdgsc.ctu@gmail.com</a>
            <h3 className="gdg-shell-address-title">Address</h3>
            <a
              className="gdg-shell-address"
              href="https://www.google.com/maps/place/Cebu+Technological+University+-+Main+Campus/@10.2966625,123.9039342,17z/data=!3m1!4b1!4m6!3m5!1s0x33a99be0240f1f91:0x9e27c0301ab69bb9!8m2!3d10.2966572!4d123.9065091!16s%2Fg%2F12cnqrc5w?entry=ttu&g_ep=EgoyMDI2MDkyMC4wIKXMDSoASAFQAw%3D%3D"
              target="_blank"
              rel="noreferrer"
            >
              M.J. Cuenco Ave, Cor R.
              <br />
              Palma Street, 6000 Cebu
              <br />
              Cebu City, Philippines,
              <br />
              6000
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
