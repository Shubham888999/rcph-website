import { useRouteError } from "react-router-dom";

// A tab opened before a new deploy asks for page files that no longer exist.
function isStaleBuildError(error) {
  const message = String(error?.message || error || "");
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(message);
}

// Shown instead of React Router's raw error screen when a page fails to load.
export default function RouteError() {
  const stale = isStaleBuildError(useRouteError());

  return (
    <main className="state-page">
      <section className="state-card">
        <p className="eyebrow">{stale ? "Website updated" : "Something went wrong"}</p>
        <h1>This page could not load</h1>
        <p>Refresh and try again.</p>
        <div className="button-row">
          <button type="button" className="button button-primary" onClick={() => window.location.reload()}>Refresh page</button>
          <a className="button button-secondary" href="/">Go to home</a>
        </div>
      </section>
    </main>
  );
}
