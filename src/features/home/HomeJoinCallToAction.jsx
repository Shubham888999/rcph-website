import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";

export default function HomeJoinCallToAction() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className="home-section home-final-cta"
      aria-labelledby="home-final-cta-title"
      initial={reduceMotion ? false : { opacity: 1, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: reduceMotion ? 0 : 0.45 }}
    >
      <p className="home-kicker">Your next chapter</p>
      <h2 id="home-final-cta-title">Join Rotaract Club of Pune Heritage</h2>
      <p>
        Want to become a member, volunteer, or collaborate with a youth service organization in Pune?
      </p>
      <div className="home-actions home-final-cta__actions">
        <Link className="button button-primary" to="/join">Join RCPH</Link>
        <Link className="button button-secondary" to="/faq">Read the FAQ</Link>
        <Link className="button button-secondary" to="/contact">Contact the Club</Link>
      </div>
    </motion.section>
  );
}
