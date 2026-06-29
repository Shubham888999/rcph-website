import { useRef, useState } from "react";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginForm({ busy, onSubmit }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    const trimmedEmail = email.trim();
    const nextErrors = {};
    if (!trimmedEmail) nextErrors.email = "Enter your email address.";
    else if (!EMAIL_PATTERN.test(trimmedEmail)) nextErrors.email = "Enter a valid email address.";
    if (!password) nextErrors.password = "Enter your password.";
    setErrors(nextErrors);

    if (nextErrors.email) {
      emailRef.current?.focus();
      return;
    }
    if (nextErrors.password) {
      passwordRef.current?.focus();
      return;
    }
    await onSubmit({ email: trimmedEmail, password });
  }

  return (
    <form className="login-form" onSubmit={handleSubmit} noValidate>
      <div className="login-field">
        <label htmlFor="login-email">Email</label>
        <input
          ref={emailRef}
          id="login-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          disabled={busy}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "login-email-error" : undefined}
          onChange={(event) => {
            setEmail(event.target.value);
            if (errors.email) setErrors((current) => ({ ...current, email: "" }));
          }}
        />
        {errors.email ? <p id="login-email-error" className="login-field-error" role="alert">{errors.email}</p> : null}
      </div>

      <div className="login-field">
        <label htmlFor="login-password">Password</label>
        <div className="login-password-control">
          <input
            ref={passwordRef}
            id="login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            disabled={busy}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "login-password-error" : undefined}
            onChange={(event) => {
              setPassword(event.target.value);
              if (errors.password) setErrors((current) => ({ ...current, password: "" }));
            }}
          />
          <button
            type="button"
            aria-pressed={showPassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
            disabled={busy}
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        {errors.password ? <p id="login-password-error" className="login-field-error" role="alert">{errors.password}</p> : null}
      </div>

      <button className="login-submit-button" type="submit" disabled={busy}>
        {busy ? "Signing in&" : "Sign in"}
      </button>
    </form>
  );
}
