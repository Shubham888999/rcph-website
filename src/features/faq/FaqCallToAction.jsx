import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";

export default function FaqCallToAction() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className="faq-section faq-cta"
      aria-labelledby="faq-cta-title"
      initial={reduceMotion ? false : { opacity: 1, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: reduceMotion ? 0 : 0.5 }}
    >
      <div>
        <p className="faq-kicker">Your next step</p>
        <h2 id="faq-cta-title">Want to Get Involved?</h2>
        <p>
          Whether you want to join Rotaract in Pune or collaborate with the club,
          these are good places to start.
        </p>
      </div>
      <div className="faq-cta__actions">
        <Link className="button button-primary" to="/join">Join RCPH</Link>
        <Link className="button button-secondary" to="/contact">Contact Us</Link>
      </div>
    </motion.section>
  );
}
