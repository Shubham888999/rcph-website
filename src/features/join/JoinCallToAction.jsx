import { Link } from "react-router-dom";
import JoinReveal from "./JoinReveal";

export default function JoinCallToAction() {
  return (
    <JoinReveal className="join-section join-cta" labelledBy="join-cta-title">
      <div>
        <p className="join-kicker">Choose your next step</p>
        <h2 id="join-cta-title">Ready to Connect?</h2>
        <p>
          Start with the option that fits you best.
        </p>
      </div>
      <div className="join-cta__actions">
        <Link className="button button-primary" to="/login">
          Create Member Account
        </Link>
        <Link className="button button-secondary" to="/contact">
          Contact RCPH
        </Link>
        <Link className="join-text-link" to="/faq">
          Read the RCPH FAQ
        </Link>
      </div>
    </JoinReveal>
  );
}
