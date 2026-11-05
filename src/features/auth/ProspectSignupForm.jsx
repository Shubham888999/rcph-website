import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import AuthNotice from "./AuthNotice";
import GoogleSignupButton from "./GoogleSignupButton";
import SignupCommonFields, { SignupGenderFields } from "./SignupCommonFields";
import SignupConsents from "./SignupConsents";
import { PROSPECT_STEPS } from "./signupModel";

function ErrorText({ id, children }) {
  return children ? <p id={id} className="signup-field-error" role="alert">{children}</p> : null;
}

export default function ProspectSignupForm(props) {
  const headingRef = useRef(null);
  const { form, errors, busy, notice, profileCompletion, showPasswords, step, invited, onTogglePasswords, onChange, onNext, onPreviousStep, onSubmit, onSkip, onGoogle, onBack } = props;
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  if (step === PROSPECT_STEPS.ABOUT) {
    return (
      <section className="signup-form-section">
        <button className="signup-back-button" type="button" disabled={Boolean(busy)} onClick={onPreviousStep}>Back to your details</button>
        <p className="login-kicker">Prospect application · Step 2 of 2</p>
        <h2 ref={headingRef} tabIndex={-1}>About you (optional)</h2>
        <p className="signup-intro">These answers help us get to know you. You can skip them and add them later.</p>
        <AuthNotice message={notice?.message} tone={notice?.tone} />
        <form className="signup-form" onSubmit={(event) => { event.preventDefault(); onSubmit("password"); }} noValidate aria-busy={Boolean(busy)}>
          <fieldset className="signup-fieldset">
            <legend>About you</legend>
            <SignupGenderFields form={form} errors={errors} disabled={Boolean(busy)} onChange={onChange} />
            <div className="signup-field">
              <label htmlFor="signup-hobbies">Hobbies and interests</label>
              <textarea id="signup-hobbies" value={form.hobbies} disabled={Boolean(busy)} aria-invalid={Boolean(errors.hobbies)} aria-describedby={errors.hobbies ? "signup-hobbies-error" : undefined} onChange={(event) => onChange("hobbies", event.target.value)} />
              <ErrorText id="signup-hobbies-error">{errors.hobbies}</ErrorText>
            </div>
            <div className="signup-field">
              <label htmlFor="signup-previousRotaract">Have you been part of Rotaract before?</label>
              <select id="signup-previousRotaract" value={form.previousRotaract} disabled={Boolean(busy)} aria-invalid={Boolean(errors.previousRotaract)} aria-describedby={errors.previousRotaract ? "signup-previous-error" : undefined} onChange={(event) => onChange("previousRotaract", event.target.value)}>
                <option value="">Select an option</option><option value="yes">Yes</option><option value="no">No</option>
              </select>
              <ErrorText id="signup-previous-error">{errors.previousRotaract}</ErrorText>
            </div>
            {form.previousRotaract === "yes" ? (
              <div className="signup-field">
                <label htmlFor="signup-previousRotaractDetails">Previous Rotaract experience</label>
                <textarea id="signup-previousRotaractDetails" value={form.previousRotaractDetails} disabled={Boolean(busy)} aria-invalid={Boolean(errors.previousRotaractDetails)} aria-describedby={errors.previousRotaractDetails ? "signup-previous-details-error" : undefined} onChange={(event) => onChange("previousRotaractDetails", event.target.value)} />
                <ErrorText id="signup-previous-details-error">{errors.previousRotaractDetails}</ErrorText>
              </div>
            ) : null}
            <div className="signup-field">
              <label htmlFor="signup-joinReason">Why do you want to join RCPH?</label>
              <textarea id="signup-joinReason" value={form.joinReason} disabled={Boolean(busy)} aria-invalid={Boolean(errors.joinReason)} aria-describedby={errors.joinReason ? "signup-reason-error" : undefined} onChange={(event) => onChange("joinReason", event.target.value)} />
              <ErrorText id="signup-reason-error">{errors.joinReason}</ErrorText>
            </div>
            <div className="signup-field">
              <label htmlFor="signup-referred">Were you referred by someone?</label>
              <select id="signup-referred" value={form.referred} disabled={Boolean(busy)} aria-invalid={Boolean(errors.referred)} aria-describedby={errors.referred ? "signup-referred-error" : undefined} onChange={(event) => onChange("referred", event.target.value)}>
                <option value="">Select an option</option><option value="yes">Yes</option><option value="no">No</option>
              </select>
              <ErrorText id="signup-referred-error">{errors.referred}</ErrorText>
            </div>
            {form.referred === "yes" ? (
              <div className="signup-field">
                <label htmlFor="signup-referredBy">Who referred you?</label>
                <input id="signup-referredBy" type="text" value={form.referredBy} disabled={Boolean(busy)} aria-invalid={Boolean(errors.referredBy)} aria-describedby={errors.referredBy ? "signup-referrer-error" : undefined} onChange={(event) => onChange("referredBy", event.target.value)} />
                <ErrorText id="signup-referrer-error">{errors.referredBy}</ErrorText>
              </div>
            ) : null}
          </fieldset>
          <button className="signup-primary-button" type="submit" disabled={Boolean(busy)}>{busy ? "Creating account..." : "Create my account"}</button>
          <button className="signup-skip-button" type="button" disabled={Boolean(busy)} onClick={onSkip}>Skip and create account</button>
        </form>
      </section>
    );
  }

  return (
    <section className="signup-form-section">
      <button className="signup-back-button" type="button" disabled={Boolean(busy)} onClick={onBack}>Back to account type</button>
      <p className="login-kicker">Prospect application · Step 1 of 2</p>
      <h2 ref={headingRef} tabIndex={-1}>Your details</h2>
      <p className="signup-intro">Join RCPH as a Prospect. It only takes a minute.</p>
      {invited ? <p className="signup-invited" role="status">You were invited by an RCPH member</p> : null}
      <AuthNotice message={notice?.message} tone={notice?.tone} />
      {!profileCompletion ? (
        <>
          <GoogleSignupButton busy={busy === "google"} disabled={Boolean(busy)} onClick={onGoogle} />
          <div className="signup-divider"><span>or sign up with email</span></div>
        </>
      ) : null}
      <form className="signup-form" onSubmit={(event) => { event.preventDefault(); onNext(); }} noValidate aria-busy={Boolean(busy)}>
        <SignupCommonFields
          form={form}
          errors={errors}
          disabled={Boolean(busy)}
          emailLocked={profileCompletion}
          hideGender
          showCredentials={!profileCompletion}
          showPasswords={showPasswords}
          onTogglePasswords={onTogglePasswords}
          onChange={onChange}
        />
        <SignupConsents form={form} errors={errors} disabled={Boolean(busy)} onChange={onChange} />
        <button className="signup-primary-button" type="submit" disabled={Boolean(busy)}>Next</button>
      </form>
      <Link className="signup-text-link" to="/login">Back to sign in</Link>
    </section>
  );
}
