import { Link } from "react-router-dom";

export default function SignupConsents({ form, errors, disabled, onChange }) {
  const describedBy = errors.legalAccepted ? "signup-legalAccepted-help signup-legalAccepted-error" : "signup-legalAccepted-help";
  const keepLinkIndependent = (event) => event.stopPropagation();
  return (
    <fieldset className="signup-consents">
      <legend>Agreement and communication preferences</legend>
      <div className={`signup-consent-row ${errors.legalAccepted ? "has-error" : ""}`}>
        <input id="signup-legalAccepted" type="checkbox" checked={form.legalAccepted} disabled={Boolean(disabled)} required aria-required="true" aria-invalid={Boolean(errors.legalAccepted)} aria-describedby={describedBy} onChange={(event) => onChange("legalAccepted", event.target.checked)} />
        <div>
          <span className="signup-consent-status">Required</span>
          <label htmlFor="signup-legalAccepted">I have read and agree to the RCPH <Link to="/terms" onClick={keepLinkIndependent}>Terms and Conditions</Link> and <Link to="/privacy" onClick={keepLinkIndependent}>Privacy Notice</Link>. I consent to RCPH collecting and processing the personal data necessary to create and administer my account, verify my prospect, member, or District Official status, manage club participation, attendance, dues, events, access permissions, and essential club communications.</label>
          {errors.legalAccepted ? <p id="signup-legalAccepted-error" className="signup-field-error" role="alert">{errors.legalAccepted}</p> : null}
        </div>
      </div>
      <div className="signup-consent-row">
        <input id="signup-communicationsOptIn" type="checkbox" checked={form.communicationsOptIn} disabled={Boolean(disabled)} aria-describedby="signup-communicationsOptIn-help" onChange={(event) => onChange("communicationsOptIn", event.target.checked)} />
        <div>
          <span className="signup-consent-status">Optional</span>
          <label htmlFor="signup-communicationsOptIn">I would like to receive optional emails and reminders about upcoming RCPH events, activities, opportunities, and general announcements. I understand that I can withdraw this consent at any time and that declining will not affect my account, prospect application, membership status, or District Official request.</label>
        </div>
      </div>
    </fieldset>
  );
}
