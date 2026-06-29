import { Link } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import "../../styles/components/auth-access.css";

function labelRole(role) {
  const labels = {
    prospect: "Prospect",
    gbm: "GBM",
    bod: "BOD",
    admin: "Admin",
    president: "President",
  };
  return labels[role] || "Member";
}

export default function AccessPage() {
  const { access, user, signOut } = useAuth();
  const profile = access?.user || {};
  const displayName = profile.name || user?.displayName || user?.email || "RCPH Member";
  const email = profile.email || user?.email || "";

  return (
    <main className="auth-access-page">
      <section className="access-hub" aria-labelledby="access-hub-title">
        <header className="access-hub__header">
          <div>
            <p className="auth-access-kicker">Trusted access verified</p>
            <h1 id="access-hub-title">Welcome, {displayName}</h1>
            {email ? <p>{email}</p> : null}
          </div>
          <button className="auth-signout-button" type="button" onClick={signOut}>Sign out</button>
        </header>

        <dl className="access-summary">
          <div><dt>Stored role</dt><dd>{labelRole(access.storedRole)}</dd></div>
          {access.positionKeys.length ? (
            <div><dt>Trusted position keys</dt><dd>{access.positionKeys.join(", ").toUpperCase()}</dd></div>
          ) : null}
        </dl>

        <div className="access-card-grid">
          {access.canAccessMemberDashboard ? (
            <article className="access-card">
              <p className="auth-access-kicker">Member area</p>
              <h2>Member Dashboard</h2>
              <p>Your verified member dashboard shell.</p>
              <Link to="/dashboard">Open Dashboard</Link>
            </article>
          ) : null}
          {access.canAccessProspectDashboard ? (
            <article className="access-card">
              <p className="auth-access-kicker">Prospect area</p>
              <h2>Membership Progress</h2>
              <p>Prospect onboarding modules will be migrated in a later phase.</p>
              <Link to="/dashboard">Open Progress Shell</Link>
            </article>
          ) : null}
          {access.canAccessBodTools ? (
            <article className="access-card">
              <p className="auth-access-kicker">BOD capability</p>
              <h2>BOD Tools</h2>
              <p>Your trusted account includes BOD access. The React tool is not migrated yet.</p>
            </article>
          ) : null}
          {access.canAccessAdminTools ? (
            <article className="access-card">
              <p className="auth-access-kicker">Administration</p>
              <h2>Admin Tools</h2>
              <p>Open the verified Admin placeholder. No admin operations are available yet.</p>
              <Link to="/admin">Open Admin Shell</Link>
            </article>
          ) : null}
          {access.canAccessPresidentControls ? (
            <article className="access-card">
              <p className="auth-access-kicker">Trusted authority</p>
              <h2>President Controls</h2>
              <p>The server granted president-level authority. Control modules are not migrated yet.</p>
            </article>
          ) : null}
        </div>

        <Link className="access-home-link" to="/">Return to public homepage</Link>
      </section>
    </main>
  );
}
