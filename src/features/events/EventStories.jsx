import { motion, useReducedMotion } from "framer-motion";

export default function EventStories() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className="events-section-react"
      aria-labelledby="event-stories-title"
      initial={reduceMotion ? false : { opacity: 1, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.16 }}
      transition={{ duration: reduceMotion ? 0 : 0.5 }}
    >
      <div className="events-section-react__heading">
        <p className="events-kicker">From the field</p>
        <h2 id="event-stories-title">Event Stories &amp; Reports</h2>
        <p>Read public reports from selected RCPH events and service initiatives.</p>
      </div>
      <article className="event-story-card">
        <div>
          <p className="events-kicker">Community Service</p>
          <h3>Pages of Hope</h3>
          <p>
            A book donation initiative supporting students through learning
            resources and meaningful interaction.
          </p>
        </div>
        <a
          className="button button-secondary"
          href="https://rcph3131.org/events/pages-of-hope.html"
        >
          Read Event Report
        </a>
      </article>
    </motion.section>
  );
}
