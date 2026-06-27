import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";

export default function EventsCallToAction() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className="events-section-react events-cta"
      aria-labelledby="events-cta-title"
      initial={reduceMotion ? false : { opacity: 1, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: reduceMotion ? 0 : 0.5 }}
    >
      <div>
        <p className="events-kicker">Take part</p>
        <h2 id="events-cta-title">How to Attend or Collaborate</h2>
        <p>
          Members, volunteers, colleges, NGOs, Rotary clubs, sponsors, and
          community partners can connect with RCPH.
        </p>
      </div>
      <nav className="events-cta__links" aria-label="Events next steps">
        <Link to="/join">Join RCPH</Link>
        <Link to="/projects">Browse Projects</Link>
        <Link to="/faq">Read the FAQ</Link>
        <Link to="/contact">Contact RCPH</Link>
      </nav>
    </motion.section>
  );
}
