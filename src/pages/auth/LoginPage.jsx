import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthNotice from "../../features/auth/AuthNotice";
import AuthStateScreen from "../../features/auth/AuthStateScreen";
import GoogleSignInButton from "../../features/auth/GoogleSignInButton";
import LoginForm from "../../features/auth/LoginForm";
import { DEFAULT_SIGN_IN_ERROR, getSafeAuthError } from "../../features/auth/authErrors";
import {
  completeGoogleRedirectResult,
  signInWithEmailPassword,
  signInWithGoogle,
} from "../../features/auth/authService";
import { getSafeLoginDestination } from "../../features/auth/loginRedirect";
import useAuth from "../../hooks/useAuth";
import "../../styles/components/login.css";

function LoginVerificationState({ message = "Verifying your trusted RCPH access…" }) {
  return (
    <main className="login-page-react">
      <section className="login-verification" role="status" aria-live="polite">
        <img src="/images/rcph-lakshya-logo.webp" alt="" aria-hidden="true" />
        <p className="login-kicker">Secure member access</p>
        <h1>Checking your account</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}

export default function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { accountState, authLoading, isAuthenticated } = useAuth();
  const destination = useMemo(
    () => getSafeLoginDestination(location.state?.from),
    [location.state?.from],
  );
  const [busyMethod, setBusyMethod] = useState("");
  const [redirectChecking, setRedirectChecking] = useState(true);
  const [awaitingTrustedAccess, setAwaitingTrustedAccess] = useState(false);
  const [notice, setNotice] = useState(null);
  const attemptInFlightRef = useRef(false);

  useEffect(() => {
    let active = true;
    completeGoogleRedirectResult()
      .then((result) => {
        if (!active) return;
        setRedirectChecking(false);
        if (result?.user) setAwaitingTrustedAccess(true);
      })
      .catch((error) => {
        if (!active) return;
        setRedirectChecking(false);
        setBusyMethod("");
        attemptInFlightRef.current = false;
        setNotice({ tone: "error", message: getSafeAuthError(error, DEFAULT_SIGN_IN_ERROR) });
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (accountState === "approved") {
      navigate(destination, { replace: true, state: null });
    }
  }, [accountState, destination, navigate]);

  const handleEmailSignIn = useCallback(async ({ email, password }) => {
    if (attemptInFlightRef.current) return;
    attemptInFlightRef.current = true;
    setBusyMethod("email");
    setNotice(null);
    try {
      await signInWithEmailPassword(email, password);
      setAwaitingTrustedAccess(true);
    } catch (error) {
      attemptInFlightRef.current = false;
      setBusyMethod("");
      setNotice({ tone: "error", message: getSafeAuthError(error, DEFAULT_SIGN_IN_ERROR) });
    }
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    if (attemptInFlightRef.current) return;
    attemptInFlightRef.current = true;
    setBusyMethod("google");
    setNotice(null);
    try {
      const result = await signInWithGoogle();
      if (result?.user) {
        setAwaitingTrustedAccess(true);
      } else {
        setNotice({ tone: "info", message: "Redirecting to Google sign-in…" });
      }
    } catch (error) {
      attemptInFlightRef.current = false;
      setBusyMethod("");
      setNotice({ tone: "error", message: getSafeAuthError(error, DEFAULT_SIGN_IN_ERROR) });
    }
  }, []);

  const handleAccountSignOut = useCallback(() => {
    attemptInFlightRef.current = false;
    setBusyMethod("");
    setAwaitingTrustedAccess(false);
    setNotice(null);
  }, []);

  if (authLoading) return <LoginVerificationState message="Checking your current sign-in state…" />;
  if (isAuthenticated) {
    if (accountState === "approved" || accountState === "access-loading") {
      return <LoginVerificationState />;
    }
    return <AuthStateScreen state={accountState} onSignOut={handleAccountSignOut} />;
  }
  if (redirectChecking || awaitingTrustedAccess) return <LoginVerificationState />;

  const formBusy = Boolean(busyMethod);
  return (
    <main className="login-page-react">
      <div className="login-shell">
<section className="login-brand-panel" aria-labelledby="login-brand-title">
  <Link
    className="login-brand login-brand--portal"
    to="/"
    aria-label="RCPH public homepage"
  >
    <img
      src="/images/rcph-lakshya-logo.webp"
      alt="Rotaract Club of Pune Heritage — Lakshya RIY 2026–27"
    />

    <span>
      <strong>Rotaract Club of Pune Heritage</strong>
      <small>RID 3131 | Zone 4</small>
    </span>
  </Link>

  <div className="login-brand-panel__main">
    <h1 id="login-brand-title">
      <span>RCPH</span>
      <span>Account</span>
      <span>Portal</span>
    </h1>
  </div>

  <div className="login-brand-panel__footer">
    <div className="login-brand-panel__values" aria-label="Club theme">
      <span>Lakshya</span>
      <span>Shaping Aim</span>
      <span>Through Experience</span>
    </div>


  </div>
</section>

        <section className="login-card" aria-labelledby="login-title">
          <p className="login-kicker">Member access</p>
          <h2 id="login-title">Welcome back</h2>
          <p className="login-intro">Sign in with your approved RCPH account.</p>
          <AuthNotice message={notice?.message} tone={notice?.tone} />
          <LoginForm busy={formBusy} onSubmit={handleEmailSignIn} />
          <div className="login-divider"><span>or</span></div>
          <GoogleSignInButton
            busy={busyMethod === "google"}
            disabled={formBusy}
            onClick={handleGoogleSignIn}
          />
          <nav className="login-support-links" aria-label="Account support">
            <Link to="/signup">Create an account</Link>
            <Link to="/forgot-password">Forgot password?</Link>
          </nav>
          <Link className="login-home-link" to="/">Return to Home</Link>
        </section>
      </div>
    </main>
  );
}
