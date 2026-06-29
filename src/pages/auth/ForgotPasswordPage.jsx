import { Link } from "react-router-dom";
import "../../styles/components/login.css";

export default function ForgotPasswordPage() {
  return (
    <main className="login-page-react">
      <section className="auth-migration-card">
        <p className="login-kicker">Password recovery</p>
        <h1>Password recovery migration is in progress</h1>
        <p>The existing OTP recovery workflow has not been moved into React yet.</p>
        <Link className="login-submit-button" to="/login">Back to sign in</Link>
        <Link className="login-home-link" to="/">Public homepage</Link>
      </section>
    </main>
  );
}
