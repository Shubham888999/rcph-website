import AboutReveal from "./AboutReveal";

export default function AboutIdentity() {
  return (
    <AboutReveal className="about-section" labelledBy="about-identity-title">
      <article className="about-feature-card">
        <div className="about-feature-card__media">
          <span className="about-feature-card__logo rcph-logo-mark">
          <img
            src="/images/rcph-lakshya-logo.webp"
            alt="Rotaract Club of Pune Heritage Lakshya RIY 2026-27 logo"
            loading="lazy"
            decoding="async"
          />
          </span>
        </div>
        <div className="about-feature-card__copy">
          <p className="about-kicker">Lakshya identity</p>
          <h2 id="about-identity-title">RIY 2026-27 Theme</h2>
          <p>
            Lakshya presents the club's RIY 2026-27 focus:
            <strong> Shaping Aim Through Experience</strong>. Add club logo description later.
          </p>
          <p>
            The theme anchors how RCPH frames growth: setting a clear aim,
            learning through lived experience, and translating that energy into
            service, fellowship, leadership, and community impact.
          </p>
        </div>
      </article>
    </AboutReveal>
  );
}
