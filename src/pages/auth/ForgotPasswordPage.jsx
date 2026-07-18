import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import PasswordRecoveryRequest from "../../features/auth/PasswordRecoveryRequest";
import PasswordRecoveryReset from "../../features/auth/PasswordRecoveryReset";
import { getPasswordRecoveryError } from "../../features/auth/authErrors";
import {
  requestPasswordOtp,
  resetPasswordWithOtp,
} from "../../features/auth/authService";
import {
  REQUEST_CODE_SUCCESS_MESSAGE,
  createRecoveryState,
  markRecoverySuccess,
  moveToCodeSent,
  returnToRecoveryRequest,
  updateRecoveryField,
} from "../../features/auth/passwordRecoveryModel";
import "../../styles/components/login.css";
import "../../styles/components/password-recovery.css";

function RecoverySuccess() {
  const headingRef = useRef(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <section className="recovery-success" role="status" aria-live="polite">
      <p className="login-kicker">Password updated</p>
      <h2 ref={headingRef} tabIndex={-1}>Your password has been reset</h2>
      <p>You can now return to RCPH sign in with your new password.</p>
      <Link className="recovery-primary-action" to="/login">Continue to sign in</Link>
      <Link className="recovery-text-link" to="/">Public homepage</Link>
    </section>
  );
}

export default function ForgotPasswordPage() {
  const [recovery, setRecovery] = useState(() => createRecoveryState());
  const [busyAction, setBusyAction] = useState("");
  const [notice, setNotice] = useState(null);
  const submissionLockRef = useRef(false);

  async function handleRequest(email) {
    if (submissionLockRef.current) return false;
    submissionLockRef.current = true;
    setBusyAction("request");
    setNotice(null);
    try {
      await requestPasswordOtp(email);
      setRecovery((current) => moveToCodeSent(current, email));
      setNotice({ tone: "info", message: REQUEST_CODE_SUCCESS_MESSAGE });
      return true;
    } catch (error) {
      setNotice({ tone: "error", message: getPasswordRecoveryError(error, "request") });
      return false;
    } finally {
      submissionLockRef.current = false;
      setBusyAction("");
    }
  }

  async function handleReset(validation) {
    if (submissionLockRef.current) return;
    submissionLockRef.current = true;
    setBusyAction("reset");
    setNotice(null);
    try {
      await resetPasswordWithOtp(recovery.email, validation.otp, validation.newPassword);
      setRecovery((current) => markRecoverySuccess(current));
    } catch (error) {
      setNotice({ tone: "error", message: getPasswordRecoveryError(error, "reset") });
    } finally {
      submissionLockRef.current = false;
      setBusyAction("");
    }
  }

  async function handleResend() {
    if (submissionLockRef.current) return false;
    submissionLockRef.current = true;
    setBusyAction("resend");
    setNotice(null);
    try {
      await requestPasswordOtp(recovery.email);
      setNotice({ tone: "info", message: REQUEST_CODE_SUCCESS_MESSAGE });
      return true;
    } catch (error) {
      setNotice({ tone: "error", message: getPasswordRecoveryError(error, "request") });
      return false;
    } finally {
      submissionLockRef.current = false;
      setBusyAction("");
    }
  }

  function handleDifferentEmail() {
    setRecovery((current) => returnToRecoveryRequest(current));
    setNotice(null);
  }

  function handleEmailChange(value) {
    setRecovery((current) => updateRecoveryField(current, "email", value));
    if (!submissionLockRef.current && busyAction !== "request") {
      setNotice(null);
    }
  }

  return (
    <main className="login-page-react password-recovery-page">
      <div className="recovery-shell">
        <header className="recovery-header">
          <Link className="login-brand" to="/" aria-label="RCPH public homepage">
            <span className="login-brand-logo rcph-logo-mark">
              <img
                src="/images/rcph-lakshya-logo.webp"
                alt="Rotaract Club of Pune Heritage — Lakshya RIY 2026–27"
              />
            </span>
            <span><strong>RCPH</strong><small>Secure account recovery</small></span>
          </Link>
          <p className="login-kicker">Member access</p>
          <h1>Reset your password</h1>
          <p>Use the private verification code sent to your account email.</p>
        </header>

        <section className="recovery-card" aria-labelledby="recovery-step-title">
          {recovery.step === "request" ? (
            <>
              <p className="recovery-step-label">Step 1 of 2</p>
              <h2 id="recovery-step-title">Request a code</h2>
              <PasswordRecoveryRequest
                email={recovery.email}
                busy={busyAction === "request"}
                notice={notice}
                onEmailChange={handleEmailChange}
                onSubmit={handleRequest}
              />
            </>
          ) : null}

          {recovery.step === "code-sent" ? (
            <>
              <p className="recovery-step-label">Step 2 of 2</p>
              <h2 id="recovery-step-title">Verify and reset</h2>
              <PasswordRecoveryReset
                recovery={recovery}
                busyAction={busyAction}
                notice={notice}
                onFieldChange={(field, value) => setRecovery((current) => updateRecoveryField(current, field, value))}
                onSubmit={handleReset}
                onResend={handleResend}
                onUseDifferentEmail={handleDifferentEmail}
              />
            </>
          ) : null}

          {recovery.step === "success" ? <RecoverySuccess /> : null}
        </section>
      </div>
    </main>
  );
}
