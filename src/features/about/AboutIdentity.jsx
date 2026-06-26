import AboutReveal from "./AboutReveal";

export default function AboutIdentity() {
  return (
    <AboutReveal className="about-section" labelledBy="about-identity-title">
      <article className="about-feature-card">
        <div className="about-feature-card__media">
          <img
            src="/images/about/aboutuslogo.png"
            alt="RCPH heritage logo with a red Marathi Tilak Pagdi"
          />
        </div>
        <div className="about-feature-card__copy">
          <p className="about-kicker">Rooted in Pune</p>
          <h2 id="about-identity-title">About the Club Logo</h2>
          <p>
            The Rotaract Club of Pune Heritage logo features a
            <strong> Marathi Tilak Pagdi</strong> in red, a symbol of Pune’s rich
            history and cultural pride. Worn by <strong>Bal Gangadhar Tilak</strong>,
            one of India’s greatest freedom fighters, the Tilak Pagdi represents
            leadership, resilience, and a deep connection to heritage.
          </p>
          <p>
            By incorporating this iconic element, the logo reflects the club’s
            dedication to honoring Pune’s legacy while fostering unity, service,
            and community growth.
          </p>
        </div>
      </article>
    </AboutReveal>
  );
}
