import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main className="state-page">
      <section className="state-card">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p>Sorry, we couldn’t find that page. It may have moved, or the link may be incorrect.</p>
        <div className="button-row">
          <Link className="button button-primary" to="/">
            Return home
          </Link>
          <Link className="button button-secondary" to="/events">
            See events
          </Link>
        </div>
      </section>
    </main>
  );
}
