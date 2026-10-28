export default function BodBookHero({ riyLabel = "RIY 2026–27" }) {
  return <section className="bod-hero-react" aria-labelledby="bod-page-title">
    <div className="bod-hero-react__content">
      <p className="bod-kicker">The Heritage Collection · {riyLabel}</p>
      <h1 id="bod-page-title">Meet the Board</h1>
      <p className="bod-hero-react__description">The people leading Rotaract Club of Pune Heritage through service, fellowship, growth, and meaningful impact.</p>
      <p className="bod-book-hint">Choose a cover. Open a story. <span aria-hidden="true">↗</span></p>
    </div>
  </section>;
}
