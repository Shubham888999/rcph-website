import { Link } from "react-router-dom";

const ROLE_LABELS = { bod: "BOD", admin: "Admin", president: "President" };

export default function BodToolsHeader({ access, displayName, onSignOut }) {
  return (
    <header className="bod-tools-header">
      <div>
        <p className="bod-tools-kicker">Rotaract Club of Pune Heritage</p>
        <h1>BOD Event Manager</h1>
        <p>Welcome, {displayName}. Approved role: {ROLE_LABELS[access.storedRole] || "Member"}.</p>
        {access.hasWebsiteDirectorPosition && access.hasPresidentAuthority ? (
          <p className="bod-tools-authority">Website Director authority is active.</p>
        ) : null}
      </div>
      <nav aria-label="BOD tools links" className="bod-tools-header__links">
        <Link to="/access">Access Hub</Link>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/">Public homepage</Link>
        <button type="button" onClick={onSignOut}>Sign out</button>
      </nav>
    </header>
  );
}
