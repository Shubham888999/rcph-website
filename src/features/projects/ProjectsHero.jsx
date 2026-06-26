import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";

export default function ProjectsHero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="projects-hero" aria-labelledby="projects-page-title">
      <motion.div
        className="projects-hero__content"
        initial={reduceMotion ? false : { opacity: 1, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.6, ease: "easeOut" }}
      >
        <p className="projects-kicker">Community service Pune</p>
        <h1 id="projects-page-title">Projects by Rotaract Club of Pune Heritage</h1>
        <p>
          Every RCPH project starts with a simple idea: bring people together
          and do something useful with the time, energy, and skills we have. Our
          projects include education support, fellowship activities, cultural
          exchanges, leadership experiences, and collaborations with schools,
          clubs, and communities.
        </p>
        <div className="projects-actions">
          <Link className="button button-primary" to="/events">See Events</Link>
          <Link className="button button-secondary" to="/contact">Collaborate</Link>
        </div>
      </motion.div>

      <motion.div
        className="projects-hero__motif"
        initial={reduceMotion ? false : { opacity: 1, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.5 }}
        aria-hidden="true"
      >
        <span>Service</span>
        <span>Leadership</span>
        <span>Fellowship</span>
      </motion.div>
    </section>
  );
}
