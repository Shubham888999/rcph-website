import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";

export default function FaqHero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="faq-hero" aria-labelledby="faq-page-title">
      <motion.div
        initial={reduceMotion ? false : { opacity: 1, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.6, ease: "easeOut" }}
      >
        <h1 id="faq-page-title">Frequently Asked Questions</h1>
        <p>
          Find answers about Rotaract Club of Pune Heritage, our identity,
          district, sponsor club, events, projects, membership, and how to get involved.
        </p>
        <div className="faq-actions">
          <Link className="button button-primary" to="/join">Join RCPH</Link>
          <Link className="button button-secondary" to="/contact">Contact Us</Link>
        </div>
      </motion.div>
    </section>
  );
}
