import { useEffect, useRef, useState } from "react";
import AuthNotice from "./AuthNotice";
import {
  RESEND_COOLDOWN_SECONDS,
  validateRecoveryReset,
} from "./passwordRecoveryModel";

export default function PasswordRecoveryReset({
  recovery,
  busyAction,
  notice,
  onFieldChange,
  onSubmit,
  onResend,
  onUseDifferentEmail,
}) {
  const [errors, setErrors] = useState({});
  const [showPasswords, setShowPasswords] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const resendLockRef = useRef(false);
  const otpRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmationRef = useRef(null);
  const busy = Boolean(busyAction);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    const validation = validateRecoveryReset(recovery);
    setErrors(validation.errors);
    if (validation.errors.otp) {
      otpRef.current?.focus();
      return;
    }
    if (validation.errors.newPassword) {
      passwordRef.current?.focus();
      return;
    }
    if (validation.errors.confirmPassword) {
      confirmationRef.current?.focus();
      return;
    }
    await onSubmit(validation);
  }

  async function handleResend() {
    if (busy || cooldown > 0 || resendLockRef.current) return;
    resendLockRef.current = true;
    try {
      const resendSucceeded = await onResend();
      if (resendSucceeded) setCooldown(RESEND_COOLDOWN_SECONDS);
    } finally {
      resendLockRef.current = false;
    }
  }

  function updateField(field, value) {
    onFieldChange(field, value);
    if (errors[field]) setErrors((current) => ({ ...current, [field]: "" }));
  }

  return (
    <form className="recovery-form" onSubmit={handleSubmit} noValidate aria-busy={busy}>
      <AuthNotice message={notice?.message} tone={notice?.tone} />
      <p className="recovery-email-context">
        Code sent for <strong>{recovery.email}</strong>
      </p>

      <div className="recovery-field">
        <label htmlFor="recovery-otp">Six-digit verification code</label>
        <input
          ref={otpRef}
          id="recovery-otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={recovery.otp}
          disabled={busy}
          aria-invalid={Boolean(errors.otp)}
          aria-describedby={errors.otp ? "recovery-otp-error" : undefined}
          onChange={(event) => updateField("otp", event.target.value.replace(/\D/g, "").slice(0, 6))}
        />
        {errors.otp ? <p id="recovery-otp-error" className="recovery-field-error" role="alert">{errors.otp}</p> : null}
      </div>

      <div className="recovery-field">
        <label htmlFor="recovery-new-password">New password</label>
        <div className="recovery-password-control">
          <input
            ref={passwordRef}
            id="recovery-new-password"
            type={showPasswords ? "text" : "password"}
            autoComplete="new-password"
            value={recovery.newPassword}
            disabled={busy}
            aria-invalid={Boolean(errors.newPassword)}
            aria-describedby={errors.newPassword ? "recovery-new-password-error" : "recovery-password-help"}
            onChange={(event) => updateField("newPassword", event.target.value)}
          />
          <button
            type="button"
            aria-pressed={showPasswords}
            aria-label={showPasswords ? "Hide new passwords" : "Show new passwords"}
            disabled={busy}
            onClick={() => setShowPasswords((current) => !current)}
          >
            {showPasswords ? "Hide" : "Show"}
          </button>
        </div>
        <p id="recovery-password-help" className="recovery-help">Use at least 6 characters.</p>
        {errors.newPassword ? <p id="recovery-new-password-error" className="recovery-field-error" role="alert">{errors.newPassword}</p> : null}
      </div>

      <div className="recovery-field">
        <label htmlFor="recovery-confirm-password">Confirm new password</label>
        <input
          ref={confirmationRef}
          id="recovery-confirm-password"
          type={showPasswords ? "text" : "password"}
          autoComplete="new-password"
          value={recovery.confirmPassword}
          disabled={busy}
          aria-invalid={Boolean(errors.confirmPassword)}
          aria-describedby={errors.confirmPassword ? "recovery-confirm-password-error" : undefined}
          onChange={(event) => updateField("confirmPassword", event.target.value)}
        />
        {errors.confirmPassword ? <p id="recovery-confirm-password-error" className="recovery-field-error" role="alert">{errors.confirmPassword}</p> : null}
      </div>

      <button className="recovery-primary-action" type="submit" disabled={busy}>
        {busyAction === "reset" ? "Updating password…" : "Reset password"}
      </button>

      <div className="recovery-secondary-actions">
        <button type="button" disabled={busy || cooldown > 0} onClick={handleResend}>
          {busyAction === "resend"
            ? "Resending…"
            : cooldown > 0
              ? `Resend code in ${cooldown}s`
              : "Resend code"}
        </button>
        <button type="button" disabled={busy} onClick={onUseDifferentEmail}>
          Use a different email
        </button>
      </div>

      <ul className="recovery-guidance">
        <li>The code expires after 10 minutes.</li>
        <li>A maximum of five verification attempts is allowed.</li>
      </ul>
    </form>
  );
}
