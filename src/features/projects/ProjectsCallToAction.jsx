import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";

export default function ProjectsCallToAction() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className="projects-section projects-cta"
      aria-labelledby="projects-cta-title"
      initial={reduceMotion ? false : { opacity: 1, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: reduceMotion ? 0 : 0.5 }}
    >
      <div>
        <p className="projects-kicker">Partnerships welcome</p>
        <h2 id="projects-cta-title">Build With Us</h2>
        <p>
          NGOs, colleges, sponsors, and Rotary clubs can work with RCPH on
          community service projects, professional development sessions, and
          Rotaract events in Pune.
        </p>
      </div>
      <div className="projects-cta__links">
        <Link to="/events">Explore upcoming events</Link>
        <Link to="/faq">Read the RCPH FAQ</Link>
        <Link to="/contact">Contact the club</Link>
      </div>
    </motion.section>
  );
}
