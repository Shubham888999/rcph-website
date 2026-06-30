import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import AuthNotice from "./AuthNotice";
import GoogleSignupButton from "./GoogleSignupButton";
import SignupCommonFields from "./SignupCommonFields";

function ErrorText({ id, children }) {
  return children ? <p id={id} className="signup-field-error" role="alert">{children}</p> : null;
}

export default function ProspectSignupForm(props) {
  const headingRef = useRef(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  const { form, errors, busy, notice, profileCompletion, showPasswords, onTogglePasswords, onChange, onSubmit, onGoogle, onBack } = props;

  return (
    <section className="signup-form-section">
      <button className="signup-back-button" type="button" disabled={busy} onClick={onBack}>Back to account type</button>
      <p className="login-kicker">Prospect application</p>
      <h2 ref={headingRef} tabIndex={-1}>Join RCPH as a Prospect</h2>
      <p className="signup-intro">Tell us about yourself and create your account.</p>
      <AuthNotice message={notice?.message} tone={notice?.tone} />
      <form className="signup-form" onSubmit={(event) => { event.preventDefault(); onSubmit("password"); }} noValidate aria-busy={busy}>
        <SignupCommonFields
          form={form}
          errors={errors}
          disabled={busy}
          emailLocked={profileCompletion}
          showCredentials={!profileCompletion}
          showPasswords={showPasswords}
          onTogglePasswords={onTogglePasswords}
          onChange={onChange}
        />
        <fieldset className="signup-fieldset">
          <legend>About you</legend>
          <div className="signup-field">
            <label htmlFor="signup-hobbies">Hobbies and interests</label>
            <textarea id="signup-hobbies" value={form.hobbies} disabled={busy} aria-invalid={Boolean(errors.hobbies)} aria-describedby={errors.hobbies ? "signup-hobbies-error" : undefined} onChange={(event) => onChange("hobbies", event.target.value)} />
            <ErrorText id="signup-hobbies-error">{errors.hobbies}</ErrorText>
          </div>
          <div className="signup-field">
            <label htmlFor="signup-previousRotaract">Have you been part of Rotaract before?</label>
            <select id="signup-previousRotaract" value={form.previousRotaract} disabled={busy} aria-invalid={Boolean(errors.previousRotaract)} aria-describedby={errors.previousRotaract ? "signup-previous-error" : undefined} onChange={(event) => onChange("previousRotaract", event.target.value)}>
              <option value="">Select an option</option><option value="yes">Yes</option><option value="no">No</option>
            </select>
            <ErrorText id="signup-previous-error">{errors.previousRotaract}</ErrorText>
          </div>
          {form.previousRotaract === "yes" ? (
            <div className="signup-field">
              <label htmlFor="signup-previousRotaractDetails">Previous Rotaract experience</label>
              <textarea id="signup-previousRotaractDetails" value={form.previousRotaractDetails} disabled={busy} aria-invalid={Boolean(errors.previousRotaractDetails)} aria-describedby={errors.previousRotaractDetails ? "signup-previous-details-error" : undefined} onChange={(event) => onChange("previousRotaractDetails", event.target.value)} />
              <ErrorText id="signup-previous-details-error">{errors.previousRotaractDetails}</ErrorText>
            </div>
          ) : null}
          <div className="signup-field">
            <label htmlFor="signup-joinReason">Why do you want to join RCPH?</label>
            <textarea id="signup-joinReason" value={form.joinReason} disabled={busy} aria-invalid={Boolean(errors.joinReason)} aria-describedby={errors.joinReason ? "signup-reason-error" : undefined} onChange={(event) => onChange("joinReason", event.target.value)} />
            <ErrorText id="signup-reason-error">{errors.joinReason}</ErrorText>
          </div>
          <div className="signup-field">
            <label htmlFor="signup-referred">Were you referred by someone?</label>
            <select id="signup-referred" value={form.referred} disabled={busy} aria-invalid={Boolean(errors.referred)} aria-describedby={errors.referred ? "signup-referred-error" : undefined} onChange={(event) => onChange("referred", event.target.value)}>
              <option value="">Select an option</option><option value="yes">Yes</option><option value="no">No</option>
            </select>
            <ErrorText id="signup-referred-error">{errors.referred}</ErrorText>
          </div>
          {form.referred === "yes" ? (
            <div className="signup-field">
              <label htmlFor="signup-referredBy">Who referred you?</label>
              <input id="signup-referredBy" type="text" value={form.referredBy} disabled={busy} aria-invalid={Boolean(errors.referredBy)} aria-describedby={errors.referredBy ? "signup-referrer-error" : undefined} onChange={(event) => onChange("referredBy", event.target.value)} />
              <ErrorText id="signup-referrer-error">{errors.referredBy}</ErrorText>
            </div>
          ) : null}
        </fieldset>
        <button className="signup-primary-button" type="submit" disabled={busy}>{busy ? "Creating account..." : profileCompletion ? "Complete account setup" : "Create Prospect account"}</button>
      </form>
      {!profileCompletion ? (
        <><div className="signup-divider"><span>or</span></div><GoogleSignupButton busy={busy === "google"} disabled={Boolean(busy)} onClick={onGoogle} /></>
      ) : null}
      <Link className="signup-text-link" to="/login">Back to sign in</Link>
    </section>
  );
}
