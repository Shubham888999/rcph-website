import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

const navigationItems = [
  { label: "Home", to: "/" },
  { label: "About", to: "/about" },
  { label: "Events", to: "/events" },
  { label: "Projects", to: "/projects" },
  { label: "Join", to: "/join" },
  { label: "Board", to: "/bod" },
  { label: "FAQ", to: "/faq" },
  { label: "Contact", to: "/contact" },
];

export default function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);

  const closeMenu = () => {
    setMenuOpen(false);
  };

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [menuOpen]);

  return (
    <div className="public-site-shell">
      <div className="public-logo-strip" aria-label="RCPH affiliations">
        <img
          src="/images/rotaract-district-3131.webp"
          alt="Rotaract District 3131"
          className="public-affiliation-logo public-affiliation-logo--district-3131"
        />

        <span className="public-affiliation-logo public-affiliation-logo--lakshya rcph-logo-mark">
          <img
            src="/images/rcph-lakshya-logo.webp"
            alt="Rotaract Club of Pune Heritage — Lakshya RIY 2026–27"
          />
        </span>
      </div>

      <header className="public-header">
        <div className="public-header-inner">
          <NavLink className="public-brand" to="/" aria-label="RCPH home" onClick={closeMenu}>
            <span className="public-brand-logo rcph-logo-mark" aria-hidden="true">
              <img
                src="/images/rcph-lakshya-logo.webp"
                alt=""
              />
            </span>

            <span className="public-brand-copy">
              <strong>RCPH</strong>
              <small>Rotaract Club of Pune Heritage</small>
            </span>
          </NavLink>

          <nav
            id="primary-navigation"
            className={`public-navigation ${menuOpen ? "is-open" : ""}`}
            aria-label="Primary navigation"
          >
            {navigationItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={closeMenu}
                className={({ isActive }) =>
                  isActive ? "public-nav-link is-active" : "public-nav-link"
                }
              >
                {item.label}
              </NavLink>
            ))}

            <NavLink className="public-login-link" to="/login" onClick={closeMenu}>
              Login
            </NavLink>

            <NavLink className="public-join-link" to="/join" onClick={closeMenu}>
              Join RCPH
            </NavLink>
          </nav>

          <button
            ref={menuButtonRef}
            className="public-menu-toggle"
            type="button"
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMenuOpen((current) => !current)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>

      <div className="public-page-content">
        <Outlet />
      </div>

      <footer className="public-footer">
        <div className="public-footer-inner">
          <div className="public-footer-identity">
            <span className="public-footer-logo rcph-logo-mark">
              <img
                src="/images/rcph-lakshya-logo.webp"
                alt="Rotaract Club of Pune Heritage — Lakshya RIY 2026–27"
              />
            </span>

            <div>
              <strong>Rotaract Club of Pune Heritage</strong>
              <p>RID 3131 · Zone 4 · Pune</p>
            </div>
          </div>

          <div className="public-footer-links">
            <NavLink to="/about">About</NavLink>
            <NavLink to="/projects">Projects</NavLink>
            <NavLink to="/join">Join</NavLink>
            <NavLink to="/contact">Contact</NavLink>
            <NavLink to="/terms">Terms</NavLink>
            <NavLink to="/privacy">Privacy</NavLink>
          </div>

          <div className="public-footer-contact">
            <a href="mailto:rcpuneheritage3131@gmail.com">
              rcpuneheritage3131@gmail.com
            </a>

            <a
              href="https://instagram.com/rc_pune_heritage/"
              target="_blank"
              rel="noreferrer"
            >
              @rc_pune_heritage
            </a>
          </div>
        </div>

        <div className="public-footer-bottom">
          <span>© {new Date().getFullYear()} Rotaract Club of Pune Heritage</span>
          <span>Lakshya · Shaping Aim Through Experience</span>
        </div>
      </footer>
    </div>
  );
}
