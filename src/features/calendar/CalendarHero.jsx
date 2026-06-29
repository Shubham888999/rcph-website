import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";

export default function CalendarHero() {
  const reduceMotion = useReducedMotion();
  return (
    <section className="calendar-hero" aria-labelledby="calendar-page-title">
      <motion.div
        initial={reduceMotion ? false : { opacity: 1, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.55, ease: "easeOut" }}
      >
        <p className="calendar-kicker">Plan your next RCPH experience</p>
        <h1 id="calendar-page-title">Public Event Calendar</h1>
        <p>
          Explore public RCPH activities in a monthly calendar or switch to the
          list view for a compact schedule. Select any event for its full date,
          description, and service avenues.
        </p>
        <Link className="button button-secondary" to="/events">Browse the Events page</Link>
      </motion.div>
    </section>
  );
}
