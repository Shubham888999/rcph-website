import { Link } from "react-router-dom";

const ROLE_LABELS = {
  bod: "Board of Directors",
  admin: "Administrator",
  president: "President",
};

export default function BodToolsHeader({
  access,
  displayName,
  onSignOut,
  onCreateEvent,
  canCreateEvent,
  lock,
  canBypassLock,
}) {
  const roleLabel = ROLE_LABELS[access.storedRole] || "RCPH Member";
const lockReady = lock?.status === "success";
const submissionsLocked = lockReady ? lock.locked : false;

const submissionStatusText =
  lock?.status === "loading"
    ? "Checking submissions"
    : lock?.status === "error"
      ? "Submissions unavailable"
      : submissionsLocked
        ? canBypassLock
          ? "Submissions locked · President bypass"
          : "Submissions locked"
        : "Submissions open";
  return (
    <header className="bod-tools-header">
      <div className="bod-tools-header__topbar">
<Link className="bod-tools-header__brand" to="/access">
  <span className="bod-tools-header__brand-mark">RCPH</span>
  <span>Operations Portal</span>
  <span
    className={`bod-tools-header__status ${
      submissionsLocked ? "is-locked" : "is-open"
    }`}
  >
    {submissionStatusText}
  </span>
</Link>

        <nav
          aria-label="BOD tools navigation"
          className="bod-tools-header__links"
        >
          <Link to="/access">Access Hub</Link>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/">Website</Link>
          <button type="button" onClick={onSignOut}>
            Sign out
          </button>
        </nav>
      </div>

      <div className="bod-tools-header__hero">
        <div className="bod-tools-header__copy">
          <p className="bod-tools-kicker">RCPH BOD Operations</p>

<h1>
  <span>Plan. Record.</span>
  <span>Building lasting impact.</span>
</h1>

          <p className="bod-tools-header__intro">
            Create club events, maintain avenue records, synchronize
            attendance, and generate official reports from one workspace.
          </p>

          <div className="bod-tools-header__identity">
            <span>{displayName}</span>
            <span>{roleLabel}</span>

            {access.hasWebsiteDirectorPosition &&
            access.hasPresidentAuthority ? (
              <span className="bod-tools-header__authority">
                Website Director authority
              </span>
            ) : null}
          </div>
        </div>

        <div className="bod-tools-header__action-panel">
          <span className="bod-tools-header__action-label">
            Event operations
          </span>

          <strong>Create and manage Club Events</strong>

          <p>
            Maintain events across the public calendar,
            attendance, and avenue reports.
          </p>

          <button
            type="button"
            className="bod-button bod-button--primary"
            disabled={!canCreateEvent}
            onClick={onCreateEvent}
          >
            Create club event
          </button>
        </div>
      </div>
    </header>
  );
}