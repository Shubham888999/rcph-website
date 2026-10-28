export default function BodBookHero({ riyLabel = "RIY 2026–27" }) {
  return <section className="bod-hero-react" aria-labelledby="bod-page-title">
    <div className="bod-hero-react__content">
      <p className="bod-kicker">The Heritage Collection · {riyLabel}</p>
      <h1 id="bod-page-title">Meet the Board</h1>
      <div className="bod-book-motto">
        <svg className="bod-book-motto__mark" viewBox="0 0 36 42" fill="none" aria-hidden="true">
          <path d="M18 10C13 6 8 6 3 8v23c5-2 10-2 15 2V10Zm0 0c5-4 10-4 15-2v23c-5-2-10-2-15 2V10Z" stroke="currentColor" strokeWidth="1.1" />
          <path d="M7 13c2-.5 4 0 7 1M7 18c2-.5 4 0 7 1M22 14c3-1 5-1.5 7-1M22 19c3-1 5-1.5 7-1M18 1v4M18 37v4" stroke="currentColor" strokeWidth=".8" />
        </svg>
        <p className="bod-book-motto__text"><span>Different stories.</span>{" "}<em>One shared chapter.</em></p>
      </div>
      <p className="bod-book-hint">Choose a cover. Open a story. <span aria-hidden="true">↗</span></p>
    </div>
  </section>;
}
