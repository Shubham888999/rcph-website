import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";

export default function HomeBoardSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="home-section home-board-section" aria-labelledby="home-board-title">
      <motion.div
        className="home-board-section__copy"
        initial={reduceMotion ? false : { opacity: 1, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: reduceMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="home-kicker">Leadership · RIY 2025–26</p>
        <h2 id="home-board-title">Meet the Board</h2>
        <span className="home-board-section__rule" aria-hidden="true" />
        <p>The people leading Rotaract Club of Pune Heritage through service, fellowship, growth, and meaningful impact.</p>
        <Link className="button button-secondary" to="/bod">Explore the board</Link>
      </motion.div>
    </section>
  );
}
