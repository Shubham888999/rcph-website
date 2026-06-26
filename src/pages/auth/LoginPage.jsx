import { Link, useLocation } from "react-router-dom";

export default function LoginPage() {
  const location = useLocation();
  const requestedPath = location.state?.from;

  return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">Member access</p>
        <h1>Login placeholder</h1>
        <p>
          Firebase Authentication will be connected in the next foundation
          step.
        </p>

        {requestedPath ? (
          <p className="notice">
            Sign in will return you to <strong>{requestedPath}</strong>.
          </p>
        ) : null}

        <div className="placeholder-form" aria-label="Login preview">
          <label>
            Email
            <input type="email" placeholder="name@example.com" disabled />
          </label>

          <label>
            Password
            <input type="password" placeholder="��������" disabled />
          </label>

          <button className="button button-primary" type="button" disabled>
            Sign in
          </button>
        </div>

        <Link className="text-link" to="/">
          Return home
        </Link>
      </section>
    </main>
  );
}
