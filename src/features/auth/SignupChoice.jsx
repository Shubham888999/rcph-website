import { Link } from "react-router-dom";

export default function SignupChoice({ districtOfficialAvailable = false, onSelect }) {
  return (
    <section className="signup-choice" aria-labelledby="signup-choice-title">
      <p className="login-kicker">Choose your path</p>
      <h3 id="signup-choice-title">Are you already part of RCPH?</h3>
      <div className="signup-choice-grid">
        <article className="signup-choice-card">
          <p className="signup-card-label">Current club member</p>
          <h3>Existing RCPH Member</h3>
          <p>Request access as a Member, Director, or Admin.</p>
          <button type="button" onClick={() => onSelect("existing-member")}>
            Continue as a Member
          </button>
        </article>
        <article className="signup-choice-card signup-choice-card--prospect">
          <p className="signup-card-label">Interested in joining</p>
          <h3>New to RCPH</h3>
          <p>Create a Prospect account and begin your RCPH journey.</p>
          <button type="button" onClick={() => onSelect("prospect")}>
            Continue as a Prospect
          </button>
        </article>
        {districtOfficialAvailable ? (
          <article className="signup-choice-card signup-choice-card--district">
            <p className="signup-card-label">District visit team</p>
            <h3>District Official</h3>
            <p>Request access for an active Club Assembly, DZR Visit, or DRR Visit.</p>
            <button type="button" onClick={() => onSelect("district-official")}>
              Continue as District Official
            </button>
          </article>
        ) : null}
      </div>
      <Link className="signup-text-link" to="/login">Back to sign in</Link>
    </section>
  );
}
