import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main className="state-page">
      <section className="state-card">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <p>The requested React route does not exist yet.</p>
        <Link className="button button-primary" to="/">
          Return home
        </Link>
      </section>
    </main>
  );
}
