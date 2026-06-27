import { motion, useReducedMotion } from "framer-motion";
import EventCard from "./EventCard";

export default function EventList({
  id,
  kicker,
  title,
  description,
  events,
  status,
  emptyMessage,
  reload,
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className="events-section-react"
      aria-labelledby={id}
      initial={reduceMotion ? false : { opacity: 1, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: reduceMotion ? 0 : 0.5 }}
    >
      <div className="events-section-react__heading">
        <p className="events-kicker">{kicker}</p>
        <h2 id={id}>{title}</h2>
        <p>{description}</p>
      </div>

      <div className="events-status" aria-live="polite" aria-atomic="true">
        {status === "loading" ? (
          <>
            <p className="events-status__message">Loading {title.toLowerCase()}…</p>
            <div className="events-skeleton-list" aria-hidden="true">
              {[0, 1, 2].map((item) => <div className="events-skeleton" key={item} />)}
            </div>
          </>
        ) : null}

        {status === "error" ? (
          <div className="events-error" role="alert">
            <h3>Events could not be loaded</h3>
            <p>Please check your connection and try again.</p>
            <button className="button button-secondary" type="button" onClick={reload}>
              Retry
            </button>
          </div>
        ) : null}

        {status === "success" && events.length === 0 ? (
          <div className="events-empty">
            <h3>No events listed yet</h3>
            <p>{emptyMessage}</p>
          </div>
        ) : null}

        {status === "success" && events.length > 0 ? (
          <ul className="events-list-react">
            {events.map((event) => (
              <li key={event.id}><EventCard event={event} /></li>
            ))}
          </ul>
        ) : null}
      </div>
    </motion.section>
  );
}
