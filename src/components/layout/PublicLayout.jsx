import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { featuredEventBadge } from "../../features/home/wings-of-honour/wingsOfHonourData";
const HASH_SCROLL_MAX_ATTEMPTS = 24;
const HASH_SCROLL_OFFSET = 16;

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
  const location = useLocation();

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

  useEffect(() => {
    if (!location.hash) {
      return undefined;
    }

    let frameId = 0;
    let cancelled = false;
    const hash = location.hash;

    const getTargetId = () => {
      const rawId = hash.slice(1);

      try {
        return decodeURIComponent(rawId);
      } catch {
        return rawId;
      }
    };

    const getHeaderOffset = () => {
      const headerHeight = document.querySelector(".public-header")?.getBoundingClientRect().height || 0;
      return headerHeight + HASH_SCROLL_OFFSET;
    };

    const scrollToHashTarget = (attempt = 0) => {
      if (cancelled) return;

      const target = document.getElementById(getTargetId());

      if (!target) {
        if (attempt >= HASH_SCROLL_MAX_ATTEMPTS) return;

        frameId = window.requestAnimationFrame(() => scrollToHashTarget(attempt + 1));
        return;
      }

      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const targetTop = target.getBoundingClientRect().top + window.scrollY - getHeaderOffset();

      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    };

    frameId = window.requestAnimationFrame(() => scrollToHashTarget());

    return () => {
      cancelled = true;

      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [location.hash, location.pathname]);

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
            alt="Rotaract Club of Pune Heritage - Lakshya RIY 2026-27"
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

          <div className="public-updates" role="group" aria-labelledby="public-updates-title">
            <span className="public-updates-title" id="public-updates-title">What’s new</span>
            <div className="public-feature-links">
            <Link
              className="public-event-link public-feature-link public-feature-link--flight"
              to={featuredEventBadge.to}
              aria-label={featuredEventBadge.ariaLabel}
              onClick={closeMenu}
            >
              <svg className="public-feature-plane" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2c.6 0 1 .6 1 1.3V9l8 5v2l-8-2v5l3 2v1l-4-1-4 1v-1l3-2v-5l-8 2v-2l8-5V3.3C11 2.6 11.4 2 12 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
              <span className="public-event-link__live">
                {featuredEventBadge.label}
              </span>
            </Link>
            <NavLink
              className={({ isActive }) => `public-board-link public-feature-link${isActive ? " is-active" : ""}`}
              to="/bod"
              aria-label="Explore the new Board Reveal collection"
              onClick={closeMenu}
            >
              <svg className="public-feature-book" viewBox="0 0 26 24" fill="none" aria-hidden="true">
                <path d="M13 5C10 2 6 2 2 3v17c4-1 8-1 11 1V5Z" stroke="currentColor" strokeWidth="1.3" />
                <path className="public-feature-book__leaf" d="M13 5c3-3 7-3 11-2v17c-4-1-8-1-11 1V5Z" fill="currentColor" fillOpacity=".12" stroke="currentColor" strokeWidth="1.3" />
                <path d="M5 7h5M5 10h5M16 7h5M16 10h5" stroke="currentColor" strokeWidth=".9" />
              </svg>
              <span>Board Reveal</span>
            </NavLink>
            </div>
          </div>

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
  <span>Join RCPH</span>

  <svg
    className="public-join-link__arrow"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M4 10h11M11 6l4 4-4 4"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
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
