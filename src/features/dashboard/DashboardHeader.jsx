import { Link } from "react-router-dom";

export default function DashboardHeader({ title, subtitle, onSignOut }) {
  return (
    <header className="member-dashboard-header">
      <div>
        <p className="auth-access-kicker">Rotaract Club of Pune Heritage</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <nav aria-label="Dashboard actions">
        <Link to="/access">Access Hub</Link>
        <Link to="/">Public homepage</Link>
        <button type="button" onClick={onSignOut}>Sign out</button>
      </nav>
    </header>
  );
}
