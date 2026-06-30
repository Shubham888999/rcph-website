import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";

export default function EventsHero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="events-hero-react" aria-labelledby="events-page-title">
      <motion.div
        initial={reduceMotion ? false : { opacity: 1, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.6, ease: "easeOut" }}
      >
        <h1 id="events-page-title">Events by Rotaract Club of Pune Heritage</h1>
        <p>
          Our events range from service drives and General Meetings to workshops,
          fellowships, district initiatives, and collaborations across Pune. Some
          are about giving back, some are about learning, and some are simply about
          bringing people together.
        </p>
        <div className="events-actions">
          <Link className="button button-primary" to="/join">Attend or Join</Link>
          <Link className="button button-secondary" to="/projects">See Projects</Link>
        </div>
      </motion.div>
    </section>
  );
}
