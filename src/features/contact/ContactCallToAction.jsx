import { Link } from "react-router-dom";
import ContactReveal from "./ContactReveal";

export default function ContactCallToAction() {
  return (
    <ContactReveal className="contact-section contact-cta" labelledBy="contact-cta-title">
      <div>
        <p className="contact-kicker">Explore RCPH</p>
        <h2 id="contact-cta-title">Find the Right Place to Start</h2>
        <p>
          Learn about membership, explore past work, see public events, or find
          official answers about the club.
        </p>
      </div>
      <nav className="contact-cta__links" aria-label="Explore RCPH links">
        <Link to="/join">Join RCPH</Link>
        <Link to="/projects">Explore Projects</Link>
        <Link to="/events">View Events</Link>
        <Link to="/faq">Read the RCPH FAQ</Link>
      </nav>
    </ContactReveal>
  );
}
