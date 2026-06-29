import { Link } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import "../../styles/components/auth-access.css";

export default function AdminPage() {
  const { access } = useAuth();
  const delegated = !["admin", "president"].includes(access.storedRole)
    && access.hasPresidentAuthority;
  const verificationMessage = delegated
    ? access.hasWebsiteDirectorPosition
      ? "Admin access is delegated by trusted Website Director president authority."
      : "Admin access is delegated by trusted president authority."
    : `Admin access is verified from the approved ${access.storedRole} role.`;

  return (
    <main className="auth-access-page">
      <section className="verified-placeholder">
        <p className="auth-access-kicker">Trusted admin access</p>
        <h1>Admin foundation</h1>
        <p>{verificationMessage}</p>
        <p>No administrative reads, writes, or operations are implemented here yet.</p>
        <Link className="button button-primary" to="/access">Back to Access Hub</Link>
      </section>
    </main>
  );
}
