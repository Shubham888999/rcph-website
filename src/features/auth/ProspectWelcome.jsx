import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { formatEventDate } from "../events/eventModel";
import usePublicEvents from "../events/usePublicEvents";
import { PROSPECT_WELCOME_COPY as copy } from "./prospectWelcomeCopy";

export default function ProspectWelcome() {
  const headingRef = useRef(null);
  const { upcomingEvents } = usePublicEvents();
  const nextEvent = upcomingEvents[0];
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <section className="signup-success" role="status" aria-live="polite">
      <p className="login-kicker">{copy.kicker}</p>
      <h2 ref={headingRef} tabIndex={-1}>{copy.title}</h2>
      <p>{copy.body}</p>
      {nextEvent ? (
        <div className="signup-welcome-event">
          <p className="signup-card-label">{copy.eventHeading}</p>
          <strong>{nextEvent.name}</strong>
          <p>{formatEventDate(nextEvent)}</p>
          <Link className="signup-text-link" to="/events">{copy.eventsLink}</Link>
        </div>
      ) : null}
      <Link className="signup-primary-button" to="/access">{copy.dashboardLink}</Link>
      <p className="signup-welcome-contact">{copy.contactPrompt} <Link to="/contact">{copy.contactLink}</Link></p>
    </section>
  );
}
