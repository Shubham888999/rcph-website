import { Link } from "react-router-dom";

export default function SignupChoice({ onSelect }) {
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
      </div>
      <Link className="signup-text-link" to="/login">Back to sign in</Link>
    </section>
  );
}
