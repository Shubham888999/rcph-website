// Shown instead of React Router's raw error screen when a page fails to load,
// for example in a tab that was open before a new deploy.
export default function RouteError() {
  return (
    <main className="state-page">
      <section className="state-card">
        <h1>Refresh and try again</h1>
        <div className="button-row" style={{ marginTop: "1.25rem" }}>
          <button type="button" className="button button-primary" onClick={() => window.location.reload()}>Refresh</button>
        </div>
      </section>
    </main>
  );
}
