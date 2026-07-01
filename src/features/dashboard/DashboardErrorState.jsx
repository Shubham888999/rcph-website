import { Link } from "react-router-dom";

export default function DashboardErrorState({ onRetry, onSignOut }) {
  return (
    <section className="dashboard-error" role="alert" aria-labelledby="dashboard-error-title">
      <p className="dashboard-eyebrow">Dashboard unavailable</p>
      <h1 id="dashboard-error-title">We could not load your dashboard</h1>
      <p>Your protected data remains private. Retry the server-authorized request or return to the Access Hub.</p>
      <div>
        <button type="button" onClick={onRetry}>Retry</button>
        <Link to="/access">Access Hub</Link>
        <button type="button" onClick={onSignOut}>Sign out</button>
      </div>
    </section>
  );
}
