import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { copyReveal, headingReveal, staggerContainer } from "./homeMotion";

export default function HomeJoinCallToAction() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className="home-section home-final-cta"
      aria-labelledby="home-final-cta-title"
      variants={reduceMotion ? undefined : staggerContainer}
      initial={reduceMotion ? false : "hidden"}
      whileInView={reduceMotion ? undefined : "visible"}
      viewport={{ once: true, amount: 0.25 }}
    >
      <motion.p className="home-kicker" variants={reduceMotion ? undefined : copyReveal}>
        Your next chapter
      </motion.p>
      <motion.h2 id="home-final-cta-title" variants={reduceMotion ? undefined : headingReveal}>
        Join Rotaract Club of Pune Heritage
      </motion.h2>
      <motion.p variants={reduceMotion ? undefined : copyReveal}>
        Want to become a member, volunteer, or collaborate with a youth service organization in Pune?
      </motion.p>
      <motion.div className="home-actions home-final-cta__actions" variants={reduceMotion ? undefined : copyReveal}>
        <Link className="button button-primary" to="/join">Join RCPH</Link>
        <Link className="button button-secondary" to="/faq">Read the FAQ</Link>
        <Link className="button button-secondary" to="/contact">Contact the Club</Link>
      </motion.div>
    </motion.section>
  );
}
