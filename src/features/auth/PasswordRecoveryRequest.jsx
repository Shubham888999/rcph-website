import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import AuthNotice from "./AuthNotice";
import { validateRecoveryEmail } from "./passwordRecoveryModel";

export default function PasswordRecoveryRequest({
  email,
  busy,
  notice,
  onEmailChange,
  onSubmit,
}) {
  const [error, setError] = useState("");
  const emailRef = useRef(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    const validation = validateRecoveryEmail(email);
    setError(validation.error);
    if (validation.error) {
      emailRef.current?.focus();
      return;
    }
    await onSubmit(validation.email);
  }

  return (
    <form className="recovery-form" onSubmit={handleSubmit} noValidate aria-busy={busy}>
      <AuthNotice message={notice?.message} tone={notice?.tone} />
      <div className="recovery-field">
        <label htmlFor="recovery-email">Email address</label>
        <input
          ref={emailRef}
          id="recovery-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          disabled={busy}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "recovery-email-error" : "recovery-email-help"}
          onChange={(event) => {
            onEmailChange(event.target.value);
            if (error) setError("");
          }}
        />
        <p id="recovery-email-help" className="recovery-help">
          We will never reveal whether an account exists for an email address.
        </p>
        {error ? <p id="recovery-email-error" className="recovery-field-error" role="alert">{error}</p> : null}
      </div>
      <button className="recovery-primary-action" type="submit" disabled={busy}>
        {busy ? "Requesting code…" : "Send verification code"}
      </button>
      <Link className="recovery-text-link" to="/login">Back to sign in</Link>
    </form>
  );
}
