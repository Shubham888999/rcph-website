import { Link } from "react-router-dom";

export default function PublicPagePlaceholder({ title }) {
  return (
    <main className="state-page">
      <section className="state-card">
        <p className="eyebrow">Coming soon</p>
        <h1>{title}</h1>
        <p>This page is pending migration to the new React website.</p>
        <Link className="button button-primary" to="/">
          Return home
        </Link>
      </section>
    </main>
  );
}
