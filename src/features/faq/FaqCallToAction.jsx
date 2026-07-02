import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";

export default function FaqCallToAction() {
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      className="faq-contact"
      aria-labelledby="faq-contact-title"
      initial={reduceMotion ? false : { opacity: 1, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: reduceMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div>
        <p className="faq-kicker">Your next step</p>
        <h2 id="faq-contact-title">Still have a question?</h2>
        <p>Reach out to the club or explore how to join RCPH.</p>
      </div>
      <nav aria-label="FAQ next steps">
        <Link className="button button-primary" to="/contact">Contact RCPH</Link>
        <Link className="button button-secondary" to="/join">Explore Membership</Link>
      </nav>
    </motion.section>
  );
}
