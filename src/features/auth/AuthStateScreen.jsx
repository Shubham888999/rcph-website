import { Link } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import "../../styles/components/auth-access.css";

const STATE_COPY = {
  loading: {
    eyebrow: "Secure member access",
    title: "Checking access",
    message: "Please wait while your account and trusted permissions are verified.",
  },
  pending: {
    eyebrow: "Account pending",
    title: "Approval is still pending",
    message: "Your request has been received. Protected RCPH tools will become available after approval.",
  },
  rejected: {
    eyebrow: "Account status",
    title: "Access request rejected",
    message: "This account request was not approved. Please contact an RCPH admin or president for help.",
  },
  "profile-missing": {
    eyebrow: "Account setup",
    title: "Profile setup is incomplete",
    message: "Your authenticated account does not yet have a complete trusted access profile.",
  },
  inactive: {
    eyebrow: "Account status",
    title: "No active role",
    message: "No active approved role is assigned to this account. Please contact RCPH for assistance.",
  },
  "access-error": {
    eyebrow: "Verification unavailable",
    title: "Trusted access could not be verified",
    message: "Protected content remains locked. Retry the secure access check or return to the public site.",
  },
  unauthorized: {
    eyebrow: "Permission required",
    title: "This account cannot open that area",
    message: "Your trusted RCPH access does not include the capability required for this page.",
  },
};

export default function AuthStateScreen({ state = "loading", onSignOut }) {
  const { isAuthenticated, refreshAccess, signOut } = useAuth();
  const copy = STATE_COPY[state] || STATE_COPY.unauthorized;
  const loading = state === "loading";
  const handleSignOut = async () => {
    await signOut();
    onSignOut?.();
  };

  return (
    <main className="auth-access-page">
      <section
        className="auth-state-card"
        role={loading ? "status" : undefined}
        aria-live={loading ? "polite" : undefined}
        aria-labelledby="auth-state-title"
      >
        <p className="auth-access-kicker">{copy.eyebrow}</p>
        <h1 id="auth-state-title">{copy.title}</h1>
        <p>{copy.message}</p>
        <div className="auth-state-actions">
          {state === "access-error" ? (
            <button className="button button-primary" type="button" onClick={refreshAccess}>
              Retry access
            </button>
          ) : null}
          <Link className="button button-secondary" to="/">Public homepage</Link>
          {isAuthenticated && !loading ? (
            <button className="auth-signout-button" type="button" onClick={handleSignOut}>
              Sign out
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}
