import { Link } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import "../../styles/components/auth-access.css";

export default function DashboardPage() {
  const { access, user } = useAuth();
  const name = access.user?.name || user?.displayName || user?.email || "RCPH Member";
  return (
    <main className="auth-access-page">
      <section className="verified-placeholder">
        <p className="auth-access-kicker">Verified member access</p>
        <h1>Dashboard foundation</h1>
        <p><strong>{name}</strong>, your account is approved for the member dashboard.</p>
        <p>Stored role: <strong>{access.storedRole.toUpperCase()}</strong></p>
        <p>Dashboard modules have not been migrated in this phase.</p>
        <Link className="button button-primary" to="/access">Back to Access Hub</Link>
      </section>
    </main>
  );
}
