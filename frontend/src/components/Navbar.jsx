import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import '../styles/shell.css';

const JOIN_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSe8XGfS83u5u3bbwqaUlHYmYlTNqPuYPl1aULCb8xMrN91jaQ/viewform?pli=1';

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [glitch, setGlitch] = useState(false);
  const hamburgerRef = useRef(null);
  const mobileNavRef = useRef(null);
  const topbarRef = useRef(null);

  const triggerGlitch = () => {
    setGlitch(false);
    // force reflow by reading offset, then re-add
    if (topbarRef.current) {
      void topbarRef.current.offsetWidth;
    }
    setGlitch(true);
    window.setTimeout(() => setGlitch(false), 450);
  };

  const toggle = (e) => {
    e.stopPropagation();
    triggerGlitch();
    setOpen((v) => !v);
  };

  const close = () => {
    if (!open) return;
    triggerGlitch();
    setOpen(false);
  };

  useEffect(() => {
    const onDocClick = (e) => {
      if (!open) return;
      const target = e.target;
      if (
        mobileNavRef.current &&
        !mobileNavRef.current.contains(target) &&
        hamburgerRef.current &&
        !hamburgerRef.current.contains(target)
      ) {
        triggerGlitch();
        setOpen(false);
      }
    };
    const onResize = () => {
      if (window.innerWidth > 700 && open) {
        setOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('click', onDocClick);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const navLinkClass = ({ isActive }) => (isActive ? 'active' : undefined);

  return (
    <>
      <header
        ref={topbarRef}
        className={`gdg-shell-topbar${glitch ? ' gdg-shell-glitch' : ''}`}
      >
        <Link to="/" className="gdg-shell-site-logo" aria-label="GDGoC-CTU Home">
          <img
            src="/layout-assets/shell/icon.png"
            alt="GDGoC-CTU Logo"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </Link>

        <button
          ref={hamburgerRef}
          type="button"
          className={`gdg-shell-hamburger${open ? ' active' : ''}`}
          aria-label="Toggle navigation"
          aria-expanded={open}
          aria-controls="gdg-shell-mobile-nav"
          onClick={toggle}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className="gdg-shell-nav-links" aria-label="Main navigation">
          <NavLink to="/" className={navLinkClass} end>
            Home
          </NavLink>
          <NavLink to="/about" className={navLinkClass}>
            About
          </NavLink>
          <NavLink to="/team" className={navLinkClass}>
            Our Team
          </NavLink>
          <NavLink to="/events" className={navLinkClass}>
            Events
          </NavLink>
          <NavLink to="/partners" className={navLinkClass}>
            Partners
          </NavLink>
          <NavLink to="/gallery" className={navLinkClass}>
            Gallery
          </NavLink>
          <NavLink to="/contact" className={navLinkClass}>
            Contact
          </NavLink>
        </nav>

        <a
          className="gdg-shell-join-top"
          href={JOIN_FORM_URL}
          target="_blank"
          rel="noreferrer"
        >
          Join Us
        </a>
      </header>

      <nav
        id="gdg-shell-mobile-nav"
        ref={mobileNavRef}
        className={`gdg-shell-mobile-nav${open ? ' open' : ''}`}
        aria-label="Mobile navigation"
      >
        <NavLink to="/" className={navLinkClass} end onClick={close}>
          Home
        </NavLink>
        <NavLink to="/about" className={navLinkClass} onClick={close}>
          About
        </NavLink>
        <NavLink to="/team" className={navLinkClass} onClick={close}>
          Our Team
        </NavLink>
        <NavLink to="/events" className={navLinkClass} onClick={close}>
          Events
        </NavLink>
        <NavLink to="/partners" className={navLinkClass} onClick={close}>
          Partners
        </NavLink>
        <NavLink to="/gallery" className={navLinkClass} onClick={close}>
          Gallery
        </NavLink>
        <NavLink to="/contact" className={navLinkClass} onClick={close}>
          Contact
        </NavLink>
        <a href={JOIN_FORM_URL} target="_blank" rel="noreferrer" onClick={close}>
          Join Us
        </a>
      </nav>
    </>
  );
}
