import { useEffect } from "react";
import { useRouteError } from "react-router-dom";
import { isStaleBuildError, reloadForNewVersion } from "./staleBuildReload";

// Shown instead of a blank error screen when a page fails to load.
export default function RouteError() {
  const error = useRouteError();
  const stale = isStaleBuildError(error);

  useEffect(() => {
    if (stale) reloadForNewVersion();
  }, [stale]);

  return (
    <main className="state-page">
      <section className="state-card">
        <p className="eyebrow">{stale ? "Website updated" : "Something went wrong"}</p>
        <h1>{stale ? "Loading the latest version…" : "This page could not load"}</h1>
        <p>
          {stale
            ? "The website was just updated. If this page does not refresh by itself, reload it."
            : "Please reload the page. If it keeps happening, let the club know."}
        </p>
        <div className="button-row">
          <button type="button" className="button button-primary" onClick={() => window.location.reload()}>Reload page</button>
          <a className="button button-secondary" href="/">Go to home</a>
        </div>
      </section>
    </main>
  );
}
