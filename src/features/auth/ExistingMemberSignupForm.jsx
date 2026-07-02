import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import AuthNotice from "./AuthNotice";
import GoogleSignupButton from "./GoogleSignupButton";
import SignupCommonFields from "./SignupCommonFields";
import SignupConsents from "./SignupConsents";

export default function ExistingMemberSignupForm(props) {
  const headingRef = useRef(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  const { form, errors, busy, notice, profileCompletion, showPasswords, onTogglePasswords, onChange, onSubmit, onGoogle, onBack } = props;

  return (
    <section className="signup-form-section">
      <button className="signup-back-button" type="button" disabled={busy} onClick={onBack}>Back to account type</button>
      <p className="login-kicker">Existing member access</p>
      <h2 ref={headingRef} tabIndex={-1}>Request your RCPH account</h2>
      <p className="signup-intro">Member access is approved automatically. Director and Admin requests require approval.</p>
      <AuthNotice message={notice?.message} tone={notice?.tone} />
      <form className="signup-form" onSubmit={(event) => { event.preventDefault(); onSubmit("password"); }} noValidate aria-busy={busy}>
        <SignupCommonFields
          form={form}
          errors={errors}
          disabled={Boolean(busy)}
          emailLocked={profileCompletion}
          compactProfile={profileCompletion}
          showCredentials={!profileCompletion}
          showPasswords={showPasswords}
          onTogglePasswords={onTogglePasswords}
          onChange={onChange}
        />
        <fieldset className="signup-fieldset">
          <legend>Requested access</legend>
          <div className="signup-field">
            <label htmlFor="signup-requestedRole">Requested role</label>
            <select id="signup-requestedRole" value={form.requestedRole} disabled={Boolean(busy)} aria-invalid={Boolean(errors.requestedRole)} aria-describedby={errors.requestedRole ? "signup-role-error" : "signup-role-help"} onChange={(event) => onChange("requestedRole", event.target.value)}>
              <option value="gbm">GBM</option>
              <option value="bod">BOD</option>
              <option value="admin">Admin</option>
            </select>
            {errors.requestedRole ? <p id="signup-role-error" className="signup-field-error" role="alert">{errors.requestedRole}</p> : null}
          </div>
          {form.requestedRole === "admin" ? (
            <div className="signup-field">
              <label htmlFor="signup-inviteCode">Admin invite code</label>
              <input id="signup-inviteCode" type="password" autoComplete="off" value={form.inviteCode} disabled={Boolean(busy)} aria-invalid={Boolean(errors.inviteCode)} aria-describedby={errors.inviteCode ? "signup-invite-error" : "signup-invite-help"} onChange={(event) => onChange("inviteCode", event.target.value)} />
              {errors.inviteCode ? <p id="signup-invite-error" className="signup-field-error" role="alert">{errors.inviteCode}</p> : null}
            </div>
          ) : null}
        </fieldset>
        <SignupConsents form={form} errors={errors} disabled={busy} onChange={onChange} />
        <button className="signup-primary-button" type="submit" disabled={Boolean(busy)}>{busy ? "Submitting request..." : profileCompletion ? "Complete account setup" : "Create member account"}</button>
      </form>
      {!profileCompletion ? (
        <><div className="signup-divider"><span>or</span></div><GoogleSignupButton busy={busy === "google"} disabled={Boolean(busy)} onClick={onGoogle} /></>
      ) : null}
      <Link className="signup-text-link" to="/login">Back to sign in</Link>
    </section>
  );
}
