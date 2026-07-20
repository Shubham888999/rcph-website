import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import AuthNotice from "./AuthNotice";
import GoogleSignupButton from "./GoogleSignupButton";
import SignupCommonFields from "./SignupCommonFields";
import SignupConsents from "./SignupConsents";
import { DISTRICT_OFFICIAL_POSITIONS } from "./signupModel";

function ErrorText({ id, children }) {
  return children ? <p id={id} className="signup-field-error" role="alert">{children}</p> : null;
}

export default function DistrictOfficialSignupForm(props) {
  const headingRef = useRef(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  const { form, errors, busy, notice, profileCompletion, showPasswords, onTogglePasswords, onChange, onSubmit, onGoogle, onBack } = props;

  return (
    <section className="signup-form-section">
      <button className="signup-back-button" type="button" disabled={busy} onClick={onBack}>Back to account type</button>
      <p className="login-kicker">District Official access</p>
      <h2 ref={headingRef} tabIndex={-1}>Request District Official access</h2>
      <p className="signup-intro">District Official accounts are reviewed before protected areas become available.</p>
      <AuthNotice message={notice?.message} tone={notice?.tone} />
      <form className="signup-form" onSubmit={(event) => { event.preventDefault(); onSubmit("password"); }} noValidate aria-busy={busy}>
        <SignupCommonFields
          form={form}
          errors={errors}
          disabled={busy}
          emailLocked={profileCompletion}
          compactProfile
          showCredentials={!profileCompletion}
          showPasswords={showPasswords}
          onTogglePasswords={onTogglePasswords}
          onChange={onChange}
        />
        <fieldset className="signup-fieldset">
          <legend>District role</legend>
          <div className="signup-field">
            <label htmlFor="signup-districtOfficialPosition">Position</label>
            <select
              id="signup-districtOfficialPosition"
              value={form.districtOfficialPosition}
              disabled={Boolean(busy)}
              aria-invalid={Boolean(errors.districtOfficialPosition)}
              aria-describedby={errors.districtOfficialPosition ? "signup-district-position-error" : undefined}
              onChange={(event) => onChange("districtOfficialPosition", event.target.value)}
            >
              <option value="">Select a position</option>
              {DISTRICT_OFFICIAL_POSITIONS.map((position) => (
                <option key={position} value={position}>{position}</option>
              ))}
            </select>
            <ErrorText id="signup-district-position-error">{errors.districtOfficialPosition}</ErrorText>
          </div>
        </fieldset>
        <SignupConsents form={form} errors={errors} disabled={busy} onChange={onChange} />
        <button className="signup-primary-button" type="submit" disabled={Boolean(busy)}>{busy ? "Submitting request..." : profileCompletion ? "Complete account setup" : "Create District Official account"}</button>
      </form>
      {!profileCompletion ? (
        <><div className="signup-divider"><span>or</span></div><GoogleSignupButton busy={busy === "google"} disabled={Boolean(busy)} onClick={onGoogle} /></>
      ) : null}
      <Link className="signup-text-link" to="/login">Back to sign in</Link>
    </section>
  );
}
