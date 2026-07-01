import { Link } from "react-router-dom";
import {
  getAccessHubCards,
  getPositionLabels,
} from "../../features/dashboard/accessHubModel";
import { clearDashboardDataCache } from "../../features/dashboard/dashboardService";
import useAuth from "../../hooks/useAuth";
import "../../styles/components/auth-access.css";
import "../../styles/components/access-hub.css";

const ROLE_LABELS = {
  prospect: "Prospect",
  gbm: "GBM",
  bod: "BOD",
  admin: "Admin",
  president: "President",
};

const CARD_COPY = {
  dashboard: "View your attendance, upcoming events, announcements, and verified club statistics.",
  prospect: "Track your consecutive attendance, dues status, and induction readiness.",
  bod: "Create and manage club events through your trusted BOD capability.",
  admin: "Open the protected Admin Panel available to your account.",
  president: "The all module authority. Control modules remain migration-pending.",
};

export default function AccessPage() {
  const { access, user, signOut } = useAuth();
  const profile = access?.user || {};
  const displayName = profile.name || user?.displayName || user?.email || "RCPH Member";
  const email = profile.email || user?.email || "";
  const positionLabels = getPositionLabels(access.positionKeys);
  const cards = getAccessHubCards(access);

  async function handleSignOut() {
    clearDashboardDataCache(user?.uid);
    await signOut();
  }

  return (
    <main className="auth-access-page">
      <section className="access-hub access-hub--complete" aria-labelledby="access-hub-title">
        <header className="access-hub__header">
          <div>
            <h2 className="auth-access-kicker">Rotaract Club of Pune Heritage</h2>
            <h1 id="access-hub-title">Welcome, {displayName}</h1>
            {email ? <p>{email}</p> : null}
          </div>
          <button className="auth-signout-button" type="button" onClick={handleSignOut}>Sign out</button>
        </header>

        <dl className="access-summary">
          <div><dt>Role</dt><dd>{ROLE_LABELS[access.storedRole] || "Member"}</dd></div>
          {positionLabels.length ? <div><dt>Approved Positions</dt><dd>{positionLabels.join(", ")}</dd></div> : null}
          {access.hasWebsiteDirectorPosition && access.hasPresidentAuthority ? (
            <div><dt>Delegated authority</dt><dd>Website Director</dd></div>
          ) : null}
        </dl>

        <div className="access-card-grid" aria-label="Available RCPH areas">
          {cards.map((card) => (
            <article key={card.key} className={"access-card " + (card.available ? "" : "access-card--pending")}>
              <p className="auth-access-kicker">{card.available ? "Available" : "Migration pending"}</p>
              <h2>{card.title}</h2>
              <p>{CARD_COPY[card.key]}</p>
              {card.href ? <Link to={card.href}>Open {card.title}</Link> : <span className="access-unavailable">Not available yet</span>}
            </article>
          ))}
        </div>
        <Link className="access-home-link" to="/">Return to Home</Link>
      </section>
    </main>
  );
}
